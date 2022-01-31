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




## 引用

- https://react-virtual.tanstack.com/docs/overview 
- https://zhuanlan.zhihu.com/p/366416646
