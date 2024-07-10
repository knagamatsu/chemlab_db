import React, { useState, useEffect, useRef } from 'react';
import { Folder, File, Upload, ChevronRight, ChevronDown, Settings, Search, BarChart } from 'lucide-react';
import { parse } from 'papaparse';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// モックデータベース操作
const mockDatabase = {
    directories: [
        { id: 1, name: '新規材料開発プロジェクト', parentId: null },
        { id: 2, name: '高分子合成実験', parentId: 1 },
        { id: 3, name: '物性評価', parentId: 1 },
        { id: 4, name: '安定性試験', parentId: 1 },
    ],
    files: [
        {
            id: 1, name: '重合実験データ.csv', directoryId: 2, content: [
                ['実験日', '温度(℃)', '圧力(MPa)', '反応時間(h)', '収率(%)', '分子量', 'PDI'],
                ['2023-07-01', 80, 0.1, 4, 85, 50000, 1.5],
                ['2023-07-02', 85, 0.15, 5, 88, 55000, 1.4],
                ['2023-07-03', 75, 0.12, 6, 82, 48000, 1.6],
            ]
        },
        {
            id: 2, name: '物性測定結果.csv', directoryId: 3, content: [
                ['サンプルID', '引張強度(MPa)', '伸び(%)', 'ガラス転移温度(℃)', '熱分解温度(℃)', '密度(g/cm3)'],
                ['S001', 45, 250, 110, 320, 1.05],
                ['S002', 48, 230, 115, 325, 1.07],
                ['S003', 42, 270, 105, 318, 1.03],
            ]
        },
    ],
};

const IntegratedExperimentManager = () => {
    const [directories, setDirectories] = useState(mockDatabase.directories);
    const [files, setFiles] = useState(mockDatabase.files);
    const [currentDirectory, setCurrentDirectory] = useState(null);
    const [spreadsheetData, setSpreadsheetData] = useState([]);
    const [columns, setColumns] = useState([]);
    const [contextMenu, setContextMenu] = useState(null);
    const [newDirectoryName, setNewDirectoryName] = useState('');
    const [activeTab, setActiveTab] = useState('structure');
    const [expandedFolders, setExpandedFolders] = useState(new Set([1]));
    const [isDragging, setIsDragging] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    // structureタブの表示状態を管理する状態変数
    const [showStructure, setShowStructure] = useState(true);

    const fileInputRef = useRef(null);
    const dropZoneRef = useRef(null);

    useEffect(() => {
        if (currentDirectory) {
            const dirFiles = files.filter(f => f.directoryId === currentDirectory.id);
            const mergedData = mergeFileContents(dirFiles);
            setSpreadsheetData(mergedData);
            setColumns(getUniqueColumns(mergedData));
        }
    }, [currentDirectory, files]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (contextMenu && !event.target.closest('.context-menu')) {
                setContextMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [contextMenu]);

    useEffect(() => {
        const dropZone = dropZoneRef.current;
        if (dropZone && activeTab === 'structure') {
            const handleDragOver = (e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
            };
            const handleDragLeave = () => {
                setIsDragging(false);
            };
            const handleDrop = (e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                }
            };
            dropZone.addEventListener('dragover', handleDragOver);
            dropZone.addEventListener('dragleave', handleDragLeave);
            dropZone.addEventListener('drop', handleDrop);
            return () => {
                dropZone.removeEventListener('dragover', handleDragOver);
                dropZone.removeEventListener('dragleave', handleDragLeave);
                dropZone.removeEventListener('drop', handleDrop);
            };
        }
    }, [currentDirectory, activeTab]);

    const mergeFileContents = (dirFiles) => {
        let mergedData = [];
        dirFiles.forEach(file => {
            if (file.content.length > 1) {
                mergedData = [...mergedData, ...file.content.slice(1)];
            }
        });
        return mergedData;
    };

    const getUniqueColumns = (data) => {
        const allColumns = data.reduce((acc, row) => [...acc, ...Object.keys(row)], []);
        return [...new Set(allColumns)];
    };

    const handleDirectoryClick = (dir) => {
        setCurrentDirectory(dir);
        toggleFolder(dir.id);
    };

    const handleContextMenu = (e, dir) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, directory: dir });
    };

    const createNewDirectory = () => {
        if (newDirectoryName) {
            const newDir = {
                id: directories.length + 1,
                name: newDirectoryName,
                parentId: contextMenu.directory.id,
            };
            setDirectories([...directories, newDir]);
            setNewDirectoryName('');
            setContextMenu(null);
        }
    };

    const handleFileUpload = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            parse(content, {
                complete: (results) => {
                    const newFile = {
                        id: files.length + 1,
                        name: file.name,
                        directoryId: currentDirectory.id,
                        content: results.data,
                    };
                    setFiles([...files, newFile]);

                    // 新しいデータを既存のデータと結合
                    const newData = results.data.slice(1); // ヘッダーを除く
                    setSpreadsheetData(prevData => [...prevData, ...newData]);

                    // 新しい列を自動で追加
                    const newColumns = getUniqueColumns([...spreadsheetData, ...results.data]);
                    setColumns(newColumns);
                },
                header: true,
                skipEmptyLines: true,
            });
        };
        reader.readAsText(file, 'UTF-8');
    };

    const toggleFolder = (folderId) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderId)) {
                newSet.delete(folderId);
            } else {
                newSet.add(folderId);
            }
            return newSet;
        });
    };

    const renderDirectories = (parentId = null, depth = 0) => {
        return directories
            .filter(dir => dir.parentId === parentId)
            .map(dir => {
                const isExpanded = expandedFolders.has(dir.id);
                const hasChildren = directories.some(child => child.parentId === dir.id);
                return (
                    <div key={dir.id}>
                        <div
                            className="flex items-center cursor-pointer hover:bg-gray-100 py-1"
                            style={{ paddingLeft: `${depth * 20}px` }}
                            onClick={() => handleDirectoryClick(dir)}
                            onContextMenu={(e) => handleContextMenu(e, dir)}
                        >
                            {hasChildren && (
                                <span onClick={(e) => { e.stopPropagation(); toggleFolder(dir.id); }}>
                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </span>
                            )}
                            <Folder size={16} className="mr-2 text-blue-500" />
                            <span>{dir.name}</span>
                        </div>
                        {isExpanded && renderDirectories(dir.id, depth + 1)}
                    </div>
                );
            });
    };

    const renderContextMenu = () => {
        if (!contextMenu) return null;
        return (
            <div className="context-menu absolute bg-white border border-gray-300 rounded shadow-lg p-2" style={{ left: contextMenu.x, top: contextMenu.y }}>
                <input
                    type="text"
                    value={newDirectoryName}
                    onChange={(e) => setNewDirectoryName(e.target.value)}
                    placeholder="新しいディレクトリ名"
                    className="border border-gray-300 rounded px-2 py-1 mb-2"
                />
                <button onClick={createNewDirectory} className="bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">
                    作成
                </button>
            </div>
        );
    };

    const handleSearch = () => {
        const results = files.filter(file =>
            file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            file.content.some(row =>
                row.some(cell =>
                    cell.toString().toLowerCase().includes(searchTerm.toLowerCase())
                )
            )
        );
        setSearchResults(results);
    };

    const renderSearchResults = () => {
        return (
            <div>
                <h3 className="text-lg font-semibold mb-2">検索結果:</h3>
                {searchResults.map(file => (
                    <div key={file.id} className="mb-2">
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-gray-600">
                            ディレクトリ: {directories.find(d => d.id === file.directoryId)?.name}
                        </p>
                    </div>
                ))}
            </div>
        );
    };

    const analyticsData = [
        { name: '1月', 実験回数: 4, 成功率: 75 },
        { name: '2月', 実験回数: 3, 成功率: 66 },
        { name: '3月', 実験回数: 5, 成功率: 80 },
        { name: '4月', 実験回数: 4, 成功率: 100 },
        { name: '5月', 実験回数: 6, 成功率: 83 },
        { name: '6月', 実験回数: 5, 成功率: 90 },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'structure':
                return (
                    <div className="p-8">
                        {showStructure && ( // showStructureがtrueの場合のみ表示
                            <>
                                <h2 className="text-2xl font-semibold mb-4">
                                    {currentDirectory ? currentDirectory.name : 'プロジェクト概要'}
                                </h2>
                                {currentDirectory && ( // currentDirectoryがtruthy（null以外）のときのみ表示
                                    <div
                                        ref={dropZoneRef}
                                        className={`border-2 border-dashed rounded-lg p-8 mb-4 ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                                            }`}
                                    >
                                        {isDragging ? (
                                            <div className="text-center">
                                                <Upload size={48} className="mx-auto text-blue-500 mb-4" />
                                                <p className="text-blue-500">ファイルをドロップしてアップロード</p>
                                            </div>
                                        ) : (
                                            <div className="text-center">
                                                <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                                                <p className="text-gray-500 mb-2">ここにCSVファイルをドラッグ＆ドロップ</p>
                                                <p className="text-gray-400">または</p>
                                                <label className="mt-2 inline-block cursor-pointer bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                                                    ファイルを選択
                                                    <input
                                                        type="file"
                                                        accept=".csv"
                                                        className="hidden"
                                                        onChange={(e) => handleFileUpload(e.target.files[0])}
                                                        ref={fileInputRef}
                                                    />
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="overflow-x-auto bg-white rounded-lg shadow">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-gray-100">
                                                {columns.map((column, index) => (
                                                    <th key={index} className="px-4 py-2 text-left text-gray-600">{column}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {spreadsheetData.map((row, rowIndex) => (
                                                <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-gray-50' : ''}>
                                                    {columns.map((column, colIndex) => (
                                                        <td key={colIndex} className="px-4 py-2 border-t">
                                                            {row[column] || ''}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                );
            case 'search':
                return (
                    <div className="p-8">
                        <h2 className="text-lg font-semibold mb-4">検索</h2>
                        <div className="flex mb-4">
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="ファイル名やデータを検索..."
                                className="flex-grow border border-gray-300 rounded-l px-4 py-2"
                            />
                            <button
                                onClick={handleSearch}
                                className="bg-blue-500 text-white px-4 py-2 rounded-r hover:bg-blue-600"
                            >
                                検索
                            </button>
                        </div>
                        {searchResults.length > 0 && renderSearchResults()}
                    </div>
                );
            case 'settings':
                return (
                    <div className="p-8">
                        <h2 className="text-lg font-semibold mb-4">設定</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">ユーザー名</label>
                                <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">メールアドレス</label>
                                <input type="email" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">言語</label>
                                <select className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm">
                                    <option>日本語</option>
                                    <option>English</option>
                                </select>
                            </div>
                            <div>
                                <label className="flex items-center">
                                    <input type="checkbox" className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50" />
                                    <span className="ml-2">ダークモードを有効にする</span>
                                </label>
                            </div>
                            <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                                設定を保存
                            </button>
                        </div>
                    </div>
                );
            case 'analytics':
                return (
                    <div className="p-8">
                        <h2 className="text-lg font-semibold mb-4">分析ダッシュボード</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={analyticsData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis yAxisId="left" />
                                <YAxis yAxisId="right" orientation="right" />
                                <Tooltip />
                                <Legend />
                                <Line yAxisId="left" type="monotone" dataKey="実験回数" stroke="#8884d8" />
                                <Line yAxisId="right" type="monotone" dataKey="成功率" stroke="#82ca9d" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden">
            <div className="w-64 bg-white shadow-lg overflow-y-auto">
                <div className="p-4">
                    <h1 className="text-xl font-bold text-center mb-6">ChemLab DB</h1>
                </div>
                <nav className="mt-6">
                    {/* Structureタブのボタン */}
                    <button
                        key="structure"
                        onClick={() => { setActiveTab('structure'); setShowStructure(true); }}
                        className={`flex items-center w-full px-4 py-2 ${activeTab === 'structure' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        <Folder size={20} className="mr-2" />
                        <span className="capitalize">Structure</span>
                    </button>
                    {/* Structureボタン直下にディレクトリ構成を表示 */}
                    {activeTab === 'structure' && showStructure && renderDirectories()}
                    {/* 区切り線 */}
                    <hr className="my-4" />
                    {['search', 'settings', 'analytics'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex items-center w-full px-4 py-2 ${activeTab === tab ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {tab === 'search' && <Search size={20} className="mr-2" />}
                            {tab === 'settings' && <Settings size={20} className="mr-2" />}
                            {tab === 'analytics' && <BarChart size={20} className="mr-2" />}
                            <span className="capitalize">{tab}</span>
                        </button>
                    ))}
                </nav>
            </div>
            <div className="flex-1 overflow-y-auto">
                {renderContent()}
            </div>
            {renderContextMenu()}
        </div>
    );
};

export default IntegratedExperimentManager;