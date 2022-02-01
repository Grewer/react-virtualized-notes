# react-virtual-notes 源码阅读

> 前言: 这次本来想解析 react-virtualized 的源码, 但是他的内容太多, 太杂, 我们先从小的库入手, 由点及面
> 所以这次改为了 react-virtual 和 react-window 的源码, 这篇就是 react-virtual

## 什么是虚拟列表

一个虚拟列表是指当我们有成千上万条数据需要进行展示但是用户的“视窗”（一次性可见内容）又不大时我们可以通过巧妙的方法只渲染用户最大可见条数+“BufferSize”个元素并在用户进行滚动时动态更新每个元素中的内容从而达到一个和长list滚动一样的效果但花费非常少的资源。

![介绍](public/img.png)

## 使用

最简单的使用例子:

```tsx
import {useVirtual} from "./react-virtual";

function App(props) {
    const parentRef = React.useRef()

    const rowVirtualizer = useVirtual({
        size: 10000,
        parentRef,
        estimateSize: React.useCallback(() => 35, []),
    })

    return (
        <>
            {/*这里就是用户的视窗*/}
            <div
                ref={parentRef}
                className="List"
                style={{
                    height: `150px`,
                    width: `300px`,
                    overflow: 'auto',
                }}
            >
                <div
                    className="ListInner"
                    style={{
                        height: `${rowVirtualizer.totalSize}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {/*具体要渲染的节点*/}
                    {rowVirtualizer.virtualItems.map(virtualRow => (
                        <div
                            key={virtualRow.index}
                            className={virtualRow.index % 2 ? 'ListItemOdd' : 'ListItemEven'}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                        >
                            Row {virtualRow.index}
                        </div>
                    ))}
                </div>
            </div>
        </>
    )
}
```

`react-virtual` 库提供了最为关键的方法: `useVirtual` 我们就从这里来入手他的源码:


## useVirtual

我们先看他的用法之接受参数:

*   `size: Integer`
    *   要渲染列表的数量(真实数量)
*   `parentRef: React.useRef(DOMElement)`
    *   一个 ref, 通过这个来操控视窗元素, 获取视窗元素的一些属性
*   `estimateSize: Function(index) => Integer`
    *   每一项的尺寸长度, 因为是函数, 可以根据 index 来返回不同的尺寸, 当然也可以返回常数
*   `overscan: Integer`
    *   除了视窗里面默认的元素, 还需要额外渲染的, 避免滚动过快, 渲染不及时
*   `horizontal: Boolean`
    *   决定列表是横向的还是纵向的
*   `paddingStart: Integer`
    *   开头的填充高度
*   `paddingEnd: Integer`
    *   末尾的填充高度
*   `keyExtractor: Function(index) => String | Integer`
    *   只要启用了动态测量渲染，并且列表中的项目的大小或顺序发生变化，就应该传递这个函数。

这里也省略了很多 hook 类型的传参, 介绍了很多常用参数

## 引用

- https://react-virtual.tanstack.com/docs/overview 
- https://zhuanlan.zhihu.com/p/366416646
