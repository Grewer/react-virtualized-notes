## react-window

这篇是 react-window 的源码阅读, 因为此库使用的是 flow, 所以会涉及一些特殊的东西, 但是我会讲清楚的


## 使用

### List

首先是 List 的使用:

```tsx
import { FixedSizeList as List } from 'react-window';

const Row = ({ index, style }) => (
    <div style={style}>Row {index}</div>
);

const App = () => (
    <List
        height={150}
        itemCount={1000}
        itemSize={35}
        width={300}
    >
        {Row}
    </List>
);
```

相对 react-virtual 的使用来说简单了很多, 使用方便, 但是相对地, 暴露的也少了一点点

### 解析

首先它是在一整个 `createListComponent` 的基础上来创建 List 的具体方法的:

```tsx
const FixedSizeList = createListComponent({
    // ...
})

export default FixedSizeList;
```
我们先看 createListComponent 方法(这里我会忽略掉 flow 的部分语法):

```tsx
export default function createListComponent({
  getItemOffset,
  getEstimatedTotalSize,
  getItemSize,
  getOffsetForIndexAndAlignment,
  getStartIndexForOffset,
  getStopIndexForStartIndex,
  initInstanceProps,
  shouldResetStyleCacheOnItemSizeChange,
  validateProps,
}) {
    //直接就返回一个 class 组件, 没有闭包变量
  return class List extends PureComponent {
      //  初始化的时候获取的 props 参数
    _instanceProps: any = initInstanceProps(this.props, this);
    //外部元素 ref 对象
    _outerRef: ?HTMLDivElement;
    // 用来存取 定时器的
    _resetIsScrollingTimeoutId: TimeoutID | null = null;

    // 默认的参数
    static defaultProps = {
      direction: 'ltr', //  方向
      itemData: undefined, // 每一个 item 的对象
      layout: 'vertical', // 布局
      overscanCount: 2, // 上部和下部超出的 item 个数
      useIsScrolling: false, // 是否正在滚动
    };

    // 组件的 state
    state: State = {
      instance: this,
      isScrolling: false,
      scrollDirection: 'forward',
      scrollOffset:
        typeof this.props.initialScrollOffset === 'number'
          ? this.props.initialScrollOffset
          : 0, // 根据 props 来判断
      scrollUpdateWasRequested: false,
    };

    // constructor
    constructor(props: Props<T>) {
      super(props);
    }

    //  props 到 state 的映射
    static getDerivedStateFromProps(
      nextProps: Props<T>,
      prevState: State
    ): $Shape<State> | null {
        // 这个函数具体的源码我们在下面说明
        // 对于 下一步收到的 props 和上一步的 state, 做出判断
        // 如果收到的参数不规范则会报错, 可以忽略
      validateSharedProps(nextProps, prevState);
      // validateProps 此方法是外部传递的, note 1
      validateProps(nextProps);
      return null;
    }

// 滚动至某一位置
    scrollTo(scrollOffset: number): void {
      // 确保 scrollOffset 大于 0
      scrollOffset = Math.max(0, scrollOffset);

      this.setState(prevState => {
        // 同样地就 return
        if (prevState.scrollOffset === scrollOffset) {
          return null;
        }
        // 直接设置 scrollOffset
        return {
          scrollDirection:
            prevState.scrollOffset < scrollOffset ? 'forward' : 'backward',
          scrollOffset: scrollOffset,
          scrollUpdateWasRequested: true,
        };
        // 回调
      }, this._resetIsScrollingDebounced);
    }

    scrollToItem(index: number, align: ScrollToAlign = 'auto'): void {
      const { itemCount } = this.props;
      const { scrollOffset } = this.state;

      index = Math.max(0, Math.min(index, itemCount - 1));

      this.scrollTo(
        getOffsetForIndexAndAlignment(
          this.props,
          index,
          align,
          scrollOffset,
          this._instanceProps
        )
      );
    }

    componentDidMount() {
      const { direction, initialScrollOffset, layout } = this.props;

      if (typeof initialScrollOffset === 'number' && this._outerRef != null) {
        const outerRef = ((this._outerRef: any): HTMLElement);
        // TODO Deprecate direction "horizontal"
        if (direction === 'horizontal' || layout === 'horizontal') {
          outerRef.scrollLeft = initialScrollOffset;
        } else {
          outerRef.scrollTop = initialScrollOffset;
        }
      }

      this._callPropsCallbacks();
    }

    componentDidUpdate() {
      const { direction, layout } = this.props;
      const { scrollOffset, scrollUpdateWasRequested } = this.state;

      if (scrollUpdateWasRequested && this._outerRef != null) {
        const outerRef = ((this._outerRef: any): HTMLElement);

        // TODO Deprecate direction "horizontal"
        if (direction === 'horizontal' || layout === 'horizontal') {
          if (direction === 'rtl') {
            // TRICKY According to the spec, scrollLeft should be negative for RTL aligned elements.
            // This is not the case for all browsers though (e.g. Chrome reports values as positive, measured relative to the left).
            // So we need to determine which browser behavior we're dealing with, and mimic it.
            switch (getRTLOffsetType()) {
              case 'negative':
                outerRef.scrollLeft = -scrollOffset;
                break;
              case 'positive-ascending':
                outerRef.scrollLeft = scrollOffset;
                break;
              default:
                const { clientWidth, scrollWidth } = outerRef;
                outerRef.scrollLeft = scrollWidth - clientWidth - scrollOffset;
                break;
            }
          } else {
            outerRef.scrollLeft = scrollOffset;
          }
        } else {
          outerRef.scrollTop = scrollOffset;
        }
      }

      this._callPropsCallbacks();
    }

    componentWillUnmount() {
      if (this._resetIsScrollingTimeoutId !== null) {
        cancelTimeout(this._resetIsScrollingTimeoutId);
      }
    }

    render() {
      const {
        children,
        className,
        direction,
        height,
        innerRef,
        innerElementType,
        innerTagName,
        itemCount,
        itemData,
        itemKey = defaultItemKey,
        layout,
        outerElementType,
        outerTagName,
        style,
        useIsScrolling,
        width,
      } = this.props;
      const { isScrolling } = this.state;

      // TODO Deprecate direction "horizontal"
      const isHorizontal =
        direction === 'horizontal' || layout === 'horizontal';

      const onScroll = isHorizontal
        ? this._onScrollHorizontal
        : this._onScrollVertical;

      const [startIndex, stopIndex] = this._getRangeToRender();

      const items = [];
      if (itemCount > 0) {
        for (let index = startIndex; index <= stopIndex; index++) {
          items.push(
            createElement(children, {
              data: itemData,
              key: itemKey(index, itemData),
              index,
              isScrolling: useIsScrolling ? isScrolling : undefined,
              style: this._getItemStyle(index),
            })
          );
        }
      }

      // Read this value AFTER items have been created,
      // So their actual sizes (if variable) are taken into consideration.
      const estimatedTotalSize = getEstimatedTotalSize(
        this.props,
        this._instanceProps
      );

      return createElement(
        outerElementType || outerTagName || 'div',
        {
          className,
          onScroll,
          ref: this._outerRefSetter,
          style: {
            position: 'relative',
            height,
            width,
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
            willChange: 'transform',
            direction,
            ...style,
          },
        },
        createElement(innerElementType || innerTagName || 'div', {
          children: items,
          ref: innerRef,
          style: {
            height: isHorizontal ? '100%' : estimatedTotalSize,
            pointerEvents: isScrolling ? 'none' : undefined,
            width: isHorizontal ? estimatedTotalSize : '100%',
          },
        })
      );
    }

    _callOnItemsRendered: (
      overscanStartIndex: number,
      overscanStopIndex: number,
      visibleStartIndex: number,
      visibleStopIndex: number
    ) => void;
    _callOnItemsRendered = memoizeOne(
      (
        overscanStartIndex: number,
        overscanStopIndex: number,
        visibleStartIndex: number,
        visibleStopIndex: number
      ) =>
        ((this.props.onItemsRendered: any): onItemsRenderedCallback)({
          overscanStartIndex,
          overscanStopIndex,
          visibleStartIndex,
          visibleStopIndex,
        })
    );

    _callOnScroll: (
      scrollDirection: ScrollDirection,
      scrollOffset: number,
      scrollUpdateWasRequested: boolean
    ) => void;
    _callOnScroll = memoizeOne(
      (
        scrollDirection: ScrollDirection,
        scrollOffset: number,
        scrollUpdateWasRequested: boolean
      ) =>
        ((this.props.onScroll: any): onScrollCallback)({
          scrollDirection,
          scrollOffset,
          scrollUpdateWasRequested,
        })
    );

    _callPropsCallbacks() {
      if (typeof this.props.onItemsRendered === 'function') {
        const { itemCount } = this.props;
        if (itemCount > 0) {
          const [
            overscanStartIndex,
            overscanStopIndex,
            visibleStartIndex,
            visibleStopIndex,
          ] = this._getRangeToRender();
          this._callOnItemsRendered(
            overscanStartIndex,
            overscanStopIndex,
            visibleStartIndex,
            visibleStopIndex
          );
        }
      }

      if (typeof this.props.onScroll === 'function') {
        const {
          scrollDirection,
          scrollOffset,
          scrollUpdateWasRequested,
        } = this.state;
        this._callOnScroll(
          scrollDirection,
          scrollOffset,
          scrollUpdateWasRequested
        );
      }
    }

    // Lazily create and cache item styles while scrolling,
    // So that pure component sCU will prevent re-renders.
    // We maintain this cache, and pass a style prop rather than index,
    // So that List can clear cached styles and force item re-render if necessary.
    _getItemStyle: (index: number) => Object;
    _getItemStyle = (index: number): Object => {
      const { direction, itemSize, layout } = this.props;

      const itemStyleCache = this._getItemStyleCache(
        shouldResetStyleCacheOnItemSizeChange && itemSize,
        shouldResetStyleCacheOnItemSizeChange && layout,
        shouldResetStyleCacheOnItemSizeChange && direction
      );

      let style;
      if (itemStyleCache.hasOwnProperty(index)) {
        style = itemStyleCache[index];
      } else {
        const offset = getItemOffset(this.props, index, this._instanceProps);
        const size = getItemSize(this.props, index, this._instanceProps);

        // TODO Deprecate direction "horizontal"
        const isHorizontal =
          direction === 'horizontal' || layout === 'horizontal';

        const isRtl = direction === 'rtl';
        const offsetHorizontal = isHorizontal ? offset : 0;
        itemStyleCache[index] = style = {
          position: 'absolute',
          left: isRtl ? undefined : offsetHorizontal,
          right: isRtl ? offsetHorizontal : undefined,
          top: !isHorizontal ? offset : 0,
          height: !isHorizontal ? size : '100%',
          width: isHorizontal ? size : '100%',
        };
      }

      return style;
    };

    _getItemStyleCache: (_: any, __: any, ___: any) => ItemStyleCache;
    _getItemStyleCache = memoizeOne((_: any, __: any, ___: any) => ({}));

    _getRangeToRender(): [number, number, number, number] {
      const { itemCount, overscanCount } = this.props;
      const { isScrolling, scrollDirection, scrollOffset } = this.state;

      if (itemCount === 0) {
        return [0, 0, 0, 0];
      }

      const startIndex = getStartIndexForOffset(
        this.props,
        scrollOffset,
        this._instanceProps
      );
      const stopIndex = getStopIndexForStartIndex(
        this.props,
        startIndex,
        scrollOffset,
        this._instanceProps
      );

      // Overscan by one item in each direction so that tab/focus works.
      // If there isn't at least one extra item, tab loops back around.
      const overscanBackward =
        !isScrolling || scrollDirection === 'backward'
          ? Math.max(1, overscanCount)
          : 1;
      const overscanForward =
        !isScrolling || scrollDirection === 'forward'
          ? Math.max(1, overscanCount)
          : 1;

      return [
        Math.max(0, startIndex - overscanBackward),
        Math.max(0, Math.min(itemCount - 1, stopIndex + overscanForward)),
        startIndex,
        stopIndex,
      ];
    }

    _onScrollHorizontal = (event: ScrollEvent): void => {
      const { clientWidth, scrollLeft, scrollWidth } = event.currentTarget;
      this.setState(prevState => {
        if (prevState.scrollOffset === scrollLeft) {
          // Scroll position may have been updated by cDM/cDU,
          // In which case we don't need to trigger another render,
          // And we don't want to update state.isScrolling.
          return null;
        }

        const { direction } = this.props;

        let scrollOffset = scrollLeft;
        if (direction === 'rtl') {
          // TRICKY According to the spec, scrollLeft should be negative for RTL aligned elements.
          // This is not the case for all browsers though (e.g. Chrome reports values as positive, measured relative to the left).
          // It's also easier for this component if we convert offsets to the same format as they would be in for ltr.
          // So the simplest solution is to determine which browser behavior we're dealing with, and convert based on it.
          switch (getRTLOffsetType()) {
            case 'negative':
              scrollOffset = -scrollLeft;
              break;
            case 'positive-descending':
              scrollOffset = scrollWidth - clientWidth - scrollLeft;
              break;
          }
        }

        // Prevent Safari's elastic scrolling from causing visual shaking when scrolling past bounds.
        scrollOffset = Math.max(
          0,
          Math.min(scrollOffset, scrollWidth - clientWidth)
        );

        return {
          isScrolling: true,
          scrollDirection:
            prevState.scrollOffset < scrollLeft ? 'forward' : 'backward',
          scrollOffset,
          scrollUpdateWasRequested: false,
        };
      }, this._resetIsScrollingDebounced);
    };

    _onScrollVertical = (event: ScrollEvent): void => {
      const { clientHeight, scrollHeight, scrollTop } = event.currentTarget;
      this.setState(prevState => {
        if (prevState.scrollOffset === scrollTop) {
          // Scroll position may have been updated by cDM/cDU,
          // In which case we don't need to trigger another render,
          // And we don't want to update state.isScrolling.
          return null;
        }

        // Prevent Safari's elastic scrolling from causing visual shaking when scrolling past bounds.
        const scrollOffset = Math.max(
          0,
          Math.min(scrollTop, scrollHeight - clientHeight)
        );

        return {
          isScrolling: true,
          scrollDirection:
            prevState.scrollOffset < scrollOffset ? 'forward' : 'backward',
          scrollOffset,
          scrollUpdateWasRequested: false,
        };
      }, this._resetIsScrollingDebounced);
    };

    _outerRefSetter = (ref: any): void => {
      const { outerRef } = this.props;

      this._outerRef = ((ref: any): HTMLDivElement);

      if (typeof outerRef === 'function') {
        outerRef(ref);
      } else if (
        outerRef != null &&
        typeof outerRef === 'object' &&
        outerRef.hasOwnProperty('current')
      ) {
        outerRef.current = ref;
      }
    };

    _resetIsScrollingDebounced = () => {
      // 避免同一时间多次调用 此函数, 起到一个节流的作用
      if (this._resetIsScrollingTimeoutId !== null) {
        cancelTimeout(this._resetIsScrollingTimeoutId);
      }

      // requestTimeout 是一个工具函数, 在延迟 IS_SCROLLING_DEBOUNCE_INTERVAL = 150 ms 之后运行, 类似 setTimeout, 但是为什么不直接使用
      // 引出额外的问题 setTimeout和requestAnimationFrame 的区别, 有兴趣的可以自行了解
      this._resetIsScrollingTimeoutId = requestTimeout(
        this._resetIsScrolling,
        IS_SCROLLING_DEBOUNCE_INTERVAL
      );
    };

    _resetIsScrolling = () => {
      // 执行的时候清空id
      this._resetIsScrollingTimeoutId = null;

      this.setState({ isScrolling: false }, () => {
        // 在状态更新操作
        // 避免isScrolling的影响
        //  _getItemStyleCache 的具体作用, 他是一个经过 memoizeOne 过的函数
        // 而 memoizeOne 是来源于`memoize-one`仓库 https://www.npmjs.com/package/memoize-one
        // 用处是缓存最近的一个结果
        this._getItemStyleCache(-1, null);
      });
    };
  };
}

```

validateProps,

