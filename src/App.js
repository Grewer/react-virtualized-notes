import './App.css';
import React from "react";
import {useVirtual} from "./react-virtual";
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

function App2(props) {
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


export default App;
