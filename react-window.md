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
    // 这里陈列几个函数和他的具体作用

    // 滚动至 scrollOffset 的位置
    scrollTo = (scrollOffset: number):void

    // 滚动至某一 item 上, 通过传递对应序号
    scrollToItem(index: number, align: ScrollToAlign = 'auto'): void

    // 缓存参数
    _callOnItemsRendered: (
      overscanStartIndex: number,
      overscanStopIndex: number,
      visibleStartIndex: number,
      visibleStopIndex: number
    ) => void;

    // 通过 index 来获取对应的style, 其中有, 长, 宽, left, top 等具体位置属性, 同时这些属性也有缓存
    _getItemStyle: (index: number) => Object;

    // 获取序号 ,   overscanStartIndex,overscanStopIndex, visibleStartIndex, visibleStopIndex
    _getRangeToRender(): [number, number, number, number]

    // 滚动时触发对应回调, 更新scrollOffset
    _onScrollHorizontal = (event: ScrollEvent): void

    // 同上
    _onScrollVertical = (event: ScrollEvent): void
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
          // 滚动的方向
          scrollDirection:
            prevState.scrollOffset < scrollOffset ? 'forward' : 'backward',
          scrollOffset: scrollOffset,
          scrollUpdateWasRequested: true,
        };
        // 回调
      }, this._resetIsScrollingDebounced);
    }

    // 方法同上, 作用是滚动至某一个 item 上面
    scrollToItem(index: number, align: ScrollToAlign = 'auto'): void {
      const { itemCount } = this.props;
      const { scrollOffset } = this.state;

      // 保证 index 在 0 和 item 最大值之间
      index = Math.max(0, Math.min(index, itemCount - 1));

      // 调用 scrollTo 方法, 参数是 getOffsetForIndexAndAlignment 的返回值
      // 此函数作用是通过 index 获取对应 item 的偏移量, 最后通过偏移量滚动至对应的 item
      // 函数通过  createListComponent 的传参获取, 不同的 list/grid, 可能有不用的方案
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

    // mount 所作的事情
    componentDidMount() {
      const { direction, initialScrollOffset, layout } = this.props;

      // initialScrollOffset 是数字且 _outerRef 正常
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
        const outerRef = ((this._outerRef: any): HTMLElement); // outerRef可以说是最外层元素的 ref 对象

        // 这里因为版本问题 可能还会去除  direction 的 horizontal 判断
        if (direction === 'horizontal' || layout === 'horizontal') {
          if (direction === 'rtl') {
            // 针对不同的类型 来左右滚动至最 scrollOffset 的偏移量
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
          // 针对上下的滚动
          outerRef.scrollTop = scrollOffset;
        }
      }

      // 调用此函数
      // 作用是:  缓存节点, 滚动状态等数据
      this._callPropsCallbacks();
    }

    // 组件离开时清空定时器
    componentWillUnmount() {
      if (this._resetIsScrollingTimeoutId !== null) {
        cancelTimeout(this._resetIsScrollingTimeoutId);
      }
    }

    // 渲染函数
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
      // 是否滚动
      const { isScrolling } = this.state;

      // direction "horizontal"  兼容老数据
      const isHorizontal =
        direction === 'horizontal' || layout === 'horizontal';

      // 当滚动时的回调, 针对不同方向
      const onScroll = isHorizontal
        ? this._onScrollHorizontal
        : this._onScrollVertical;

      // 返回节点的范围 [真实起点, 真实终点]
      const [startIndex, stopIndex] = this._getRangeToRender();

      const items = [];
      if (itemCount > 0) {
        // 循环所有 item 数来创建 item, createElement 传递参数
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

      
      // getEstimatedTotalSize来自 父函数 props
      // 在项目被创建后读取这个值，因此它们的实际尺寸（如果是可变的）被考虑在内
      const estimatedTotalSize = getEstimatedTotalSize(
        this.props,
        this._instanceProps
      );

      // 动态, 可配置性地创建组件
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
            willChange: 'transform', // 提前优化, 相当于整体包装
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
    // 作用 , 缓存最新的这四份数据
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

// 缓存这 3 个数据
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
      // 判断来自 props 的 onItemsRendered是否是函数
      if (typeof this.props.onItemsRendered === 'function') {
        const { itemCount } = this.props;
        if (itemCount > 0) {
          // 总的数量大于 0 时
          // 从_getRangeToRender获取节点的范围
          const [
            overscanStartIndex, // 真实的起点
            overscanStopIndex, // 真实的终点
            visibleStartIndex, // 视图的起点
            visibleStopIndex, // 视图的终点
          ] = this._getRangeToRender();

          // 调用 _callOnItemsRendered, 更新缓存
          this._callOnItemsRendered(
            overscanStartIndex,
            overscanStopIndex,
            visibleStartIndex,
            visibleStopIndex
          );
        }
      }

      // 如果传递了 onScroll 函数过来
      if (typeof this.props.onScroll === 'function') {
        const {
          scrollDirection,
          scrollOffset,
          scrollUpdateWasRequested,
        } = this.state;
        // 调用此函数, 作用同样是缓存数据
        this._callOnScroll(
          scrollDirection,
          scrollOffset,
          scrollUpdateWasRequested
        );
      }
    }

    // 在滚动时 lazy 地创建和缓存项目的样式，
    // 这样 pure 组件的就可以防止重新渲染。
    // 维护这个缓存，并传递一个props而不是index，
    // 这样List就可以清除缓存的样式并在必要时强制重新渲染项目
    _getItemStyle: (index: number) => Object;
    _getItemStyle = (index: number): Object => {
      const { direction, itemSize, layout } = this.props;

      // 缓存
      const itemStyleCache = this._getItemStyleCache(
        shouldResetStyleCacheOnItemSizeChange && itemSize,
        shouldResetStyleCacheOnItemSizeChange && layout,
        shouldResetStyleCacheOnItemSizeChange && direction
      );

      let style;
      // 有缓存则取缓存, 注意 hasOwnProperty 和 in  [index] 的区别
      if (itemStyleCache.hasOwnProperty(index)) {
        style = itemStyleCache[index];
      } else {
        // getItemOffset 和 getItemSize 来自父函数 props
        const offset = getItemOffset(this.props, index, this._instanceProps);
        const size = getItemSize(this.props, index, this._instanceProps);

        const isHorizontal =
          direction === 'horizontal' || layout === 'horizontal';

        const isRtl = direction === 'rtl';
        const offsetHorizontal = isHorizontal ? offset : 0;

        // 缓存 index:{} 至 itemStyleCache 对象

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
      // 数量相关数据
      const { itemCount, overscanCount } = this.props;
      // 是否滚动, 滚动方向, 滚动距离
      const { isScrolling, scrollDirection, scrollOffset } = this.state;

      // 如果数量为 0  则 return
      if (itemCount === 0) {
        return [0, 0, 0, 0];
      }

      // 开始的x序号  getStartIndexForOffset 来源于 闭包传递, 通过距离来获取序号 
      const startIndex = getStartIndexForOffset(
        this.props,
        scrollOffset,
        this._instanceProps
      );
      // 结束的序号, 作用同上, 但是获取的是结束的序号
      const stopIndex = getStopIndexForStartIndex(
        this.props,
        startIndex,
        scrollOffset,
        this._instanceProps
      );

      // 超出的范围的数量, 前, 后 两个变量
      const overscanBackward =
        !isScrolling || scrollDirection === 'backward'
          ? Math.max(1, overscanCount)
          : 1;
      const overscanForward =
        !isScrolling || scrollDirection === 'forward'
          ? Math.max(1, overscanCount)
          : 1;

      // 最终返回数据, [开始的节点序号-超出的节点,结束的节点序号+超出的节点, 开始的节点序号, 结束的节点序号]
      return [
        Math.max(0, startIndex - overscanBackward),
        Math.max(0, Math.min(itemCount - 1, stopIndex + overscanForward)),
        startIndex,
        stopIndex,
      ];
    }

    // 大体作用会和 _onScrollVertical 类似
    _onScrollHorizontal = (event: ScrollEvent): void => {
      const { clientWidth, scrollLeft, scrollWidth } = event.currentTarget;
      this.setState(prevState => {
        if (prevState.scrollOffset === scrollLeft) {
          // 如果滚动距离不变
          return null;
        }

        const { direction } = this.props;

        let scrollOffset = scrollLeft;
        if (direction === 'rtl') {
          // 根据方向确定滚动距离
          switch (getRTLOffsetType()) {
            case 'negative':
              scrollOffset = -scrollLeft;
              break;
            case 'positive-descending':
              scrollOffset = scrollWidth - clientWidth - scrollLeft;
              break;
          }
        }

        // 保证距离在范围之内, 同时 Safari在越界时会有晃动
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

// 同上 , 这里就不多说了
    _onScrollVertical = (event: ScrollEvent): void => {
      const { clientHeight, scrollHeight, scrollTop } = event.currentTarget;
      this.setState(prevState => {
        if (prevState.scrollOffset === scrollTop) {
          return null;
        }

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
        // 用处是缓存最近的一个结果 而这里是返回一个空对象
        this._getItemStyleCache(-1, null);
      });
    };
  };
}

```

validateProps,

