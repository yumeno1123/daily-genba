import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as db from '../services/db';

const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<db.Project[]>([]);
  const [records, setRecords] = useState<db.DailyRecord[]>([]);
  const [personName, setPersonName] = useState(localStorage.getItem('personName') ?? '');
  // 人物名がすでに保存されている場合は、初期状態でスマート表示（編集モードをオフ）にする
  const [isEditingPerson, setIsEditingPerson] = useState(!personName);
  // 人物名セクションの折りたたみ状態（名前がない場合は最初から開く）
  const [isPersonOpen, setIsPersonOpen] = useState(!personName);
  // 備考・連絡事項の折りたたみ状態（初期状態は閉じた状態）
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [summary, setSummary] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  // 記録一覧で展開されているレコードのID
  const [expandedRecordId, setExpandedRecordId] = useState<number | null>(null);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    const [p, r] = await Promise.all([db.getProjects(), db.getDailyRecords()]);
    setProjects(p);
    setRecords(r);
    setLoading(false);
    
    // 初回読み込み時、もし記録があれば最新の現場IDをセットする
    if (r.length > 0 && !selectedProjectId) {
      setSelectedProjectId(r[0].projectId.toString());
    }
  }, [selectedProjectId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // 日付や人物名が変わったときに、既存の記録があれば自動でセットする
  useEffect(() => {
    if (!loading && personName && date && editingId === null) {
      const existingRecord = records.find(r => r.date === date && r.personName === personName);
      if (existingRecord) {
        setSelectedProjectId(existingRecord.projectId.toString());
        setSummary(existingRecord.summary);
      } else {
        // 既存記録がない場合は、備考のみクリア
        // 現場(projectId)は「最新の現場」を維持したいためクリアしない
        setSummary('');
      }
    }
  }, [date, personName, records, loading, editingId]);

  // 備考に内容が入った場合は、自動的に折りたたみを展開する
  useEffect(() => {
    if (summary) {
      setIsSummaryOpen(true);
    }
  }, [summary]);

  const handleSubmit = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    if (!personName || !selectedProjectId) {
      alert('人物名と現場を選択してください');
      return;
    }

    localStorage.setItem('personName', personName);

    if (editingId === null) {
      const existingRecord = records.find(r => r.date === date && r.personName === personName);
      if (existingRecord) {
        if (window.confirm(`${date} の記録は既に存在します。内容を上書き（修正）しますか？`)) {
          const targetId = existingRecord.id;
          if (targetId !== undefined) {
            await db.updateDailyRecord(targetId, {
              personName,
              date,
              projectId: parseInt(selectedProjectId),
              summary
            });
            setSummary('');
            void fetchData();
          }
          return;
        } else {
          return;
        }
      }
    }

    let isNewRecord = false;
    if (editingId !== null) {
      await db.updateDailyRecord(editingId, {
        personName,
        date,
        projectId: parseInt(selectedProjectId),
        summary
      });
      setEditingId(null);
    } else {
      await db.addDailyRecord({
        personName,
        date,
        projectId: parseInt(selectedProjectId),
        summary
      });
      isNewRecord = true;
    }

    setSummary('');
    setIsSummaryOpen(false); // 備考欄を折りたたむ
    setIsEditingPerson(false); // 人物名の編集モードを終了してスマート表示に戻す
    setIsPersonOpen(false); // 保存完了時に人物名入力欄を折りたたむ
    void fetchData();
    if (isNewRecord) {
      changeDay(1);
    }
  };

  const handleEdit = (r: db.DailyRecord) => {
    const targetId = r.id;
    if (targetId !== undefined) {
      setEditingId(targetId);
      setPersonName(r.personName);
      setDate(r.date);
      setSelectedProjectId(r.projectId.toString());
      setSummary(r.summary);
      setIsEditingPerson(false); // 編集開始時は人物名はコンパクト表示にしておく
      setIsPersonOpen(false); // 編集開始時は人物名入力欄を折りたたんだ状態にする
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('この記録を削除しますか？')) return;
    void db.deleteDailyRecord(id).then(() => fetchData());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSummary('');
    setIsSummaryOpen(false); // 備考欄を折りたたむ
  };

  const changeDay = (amount: number) => {
    const [year, month, day] = date.split('-').map(Number);
    const currentDate = new Date(year, month - 1, day);
    currentDate.setDate(currentDate.getDate() + amount);
    
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
    const d = String(currentDate.getDate()).padStart(2, '0');
    setDate(`${y}-${m}-${d}`);
  };

  // 登録済みの最新日報の日付の翌日を取得する関数
  const getNextDayOfLatestRecord = (): string | null => {
    if (records.length === 0) return null;
    // 全記録から最も新しい日付を取得する
    const latestDateStr = records.reduce((latest, r) => r.date > latest ? r.date : latest, records[0].date);
    
    // その日付の翌日を計算する
    const [year, month, day] = latestDateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    dateObj.setDate(dateObj.getDate() + 1);
    
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // 登録済みの最新日報の翌日を選択する処理
  const handleSelectNextOfLatest = () => {
    const nextDay = getNextDayOfLatestRecord();
    if (nextDay) {
      setDate(nextDay);
    }
  };

  const handleExport = () => {
    // 選択された月の全日付を生成する
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const daysInMonth = new Date(year, month, 0).getDate(); // その月の日数

    const allDates: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yearStr}-${monthStr}-${String(d).padStart(2, '0')}`;
      allDates.push(dateStr);
    }

    const filteredRecords = records.filter(r => r.date.startsWith(selectedMonth));
    const header = '日付,人物,現場名,備考\n';
    const csvRows: string[] = [];

    allDates.forEach(dateStr => {
      const dayRecords = filteredRecords.filter(r => r.date === dateStr);
      if (dayRecords.length > 0) {
        dayRecords.forEach(r => {
          csvRows.push(`"${r.date}","${r.personName}","${r.project?.name ?? '不明'}","${r.summary}"`);
        });
      } else {
        // 入力されていない日付は、日付のみ出力し他は空欄にする
        csvRows.push(`"${dateStr}","","",""`);
      }
    });

    const csv = csvRows.join('\n');
    
    const blob = new Blob(['\uFEFF' + header + csv], { type: 'text/csv; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `daily_report_${selectedMonth}.csv`;
    document.body.appendChild(a);
    a.click();
    
    // iOS等で確実に動作させるため、少し遅らせてからDOM削除とメモリ解放を行う
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  if (loading) return <div className="container">読み込み中...</div>;

  return (
    <div className="container">
      <header>
        <h1>日報記録アプリ</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select 
            value={selectedMonth} 
            onChange={(e) => { setSelectedMonth(e.target.value); }}
            style={{ padding: '8px', fontSize: '0.9rem', width: 'auto' }}
          >
            {Array.from(new Set(records.map(r => r.date.slice(0, 7)))).sort().reverse().map(m => (
              <option key={m} value={m}>{m.replace('-', '年') + '月'}</option>
            ))}
            {!records.some(r => r.date.startsWith(new Date().toISOString().slice(0, 7))) && (
              <option value={new Date().toISOString().slice(0, 7)}>{new Date().toISOString().slice(0, 7).replace('-', '年') + '月'}</option>
            )}
          </select>
          <button onClick={() => { void navigate('/projects'); }} className="btn btn-info" style={{ fontSize: '0.85rem', padding: '8px 12px' }}>現場設定</button>
          <button onClick={() => { handleExport(); }} className="btn btn-success" style={{ fontSize: '0.85rem', padding: '8px 12px' }}>CSV出力</button>
        </div>
      </header>

      <main>
        <div className="card" style={{ border: editingId !== null ? '2px solid #17a2b8' : 'none' }}>
          {editingId !== null && <h2>記録を修正する</h2>}
          <form onSubmit={(e) => { void handleSubmit(e); }}>
            <div className="form-group">
              {/* 人物名セクションの折りたたみヘッダー */}
              <div 
                onClick={() => { setIsPersonOpen(!isPersonOpen); }} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  cursor: 'pointer',
                  padding: '6px 0',
                  userSelect: 'none'
                }}
              >
                <label style={{ margin: 0, cursor: 'pointer' }}>
                  人物名 {personName && <span style={{ fontWeight: 'normal', fontSize: '0.9rem', color: '#666', marginLeft: '8px' }}>({personName})</span>}
                </label>
                <span style={{ fontSize: '0.85rem', color: '#007bff', fontWeight: 'bold' }}>
                  {isPersonOpen ? '▲ 折りたたむ' : '▼ 変更する（折りたたみ中）'}
                </span>
              </div>
              {isPersonOpen && (
                <div style={{ marginTop: '8px' }}>
                  {!isEditingPerson ? (
                    <div className="person-badge">
                      <span style={{ fontWeight: 'bold' }}>{personName || '未設定'}</span>
                      <button 
                        type="button" 
                        onClick={() => { setIsEditingPerson(true); }} 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto' }}
                      >
                        変更
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        value={personName} 
                        onChange={(e) => { setPersonName(e.target.value); }} 
                        placeholder="あなたの名前"
                        style={{ flex: 1 }}
                      />
                      {localStorage.getItem('personName') && (
                        <button 
                          type="button" 
                          onClick={() => { 
                            setIsEditingPerson(false); 
                            setIsPersonOpen(false); // 確定した際に人物名入力欄を自動的に折りたたむ
                          }} 
                          className="btn btn-secondary" 
                          style={{ padding: '8px 12px', fontSize: '0.9rem', width: 'auto' }}
                        >
                          確定
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="form-group">
              <label>日付</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input 
                  type="date" 
                  value={date} 
                  onChange={(e) => { setDate(e.target.value); }} 
                  style={{ flex: 1, minWidth: '120px' }}
                />
                <button 
                  type="button" 
                  onClick={handleSelectNextOfLatest} 
                  disabled={records.length === 0}
                  className="btn btn-secondary" 
                  style={{ 
                    padding: '8px 12px', 
                    fontSize: '0.9rem', 
                    width: 'auto',
                    opacity: records.length === 0 ? 0.5 : 1,
                    cursor: records.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                  title={records.length === 0 ? "記録がまだありません" : "記入されている最新の日付の翌日を選択します"}
                >
                  最終翌日
                </button>
                <button 
                  type="button" 
                  onClick={() => { changeDay(-1); }} 
                  className="btn btn-secondary" 
                  style={{ padding: '8px 12px', fontSize: '0.9rem', width: 'auto' }}
                >
                  ◀
                </button>
                <button 
                  type="button" 
                  onClick={() => { changeDay(1); }} 
                  className="btn btn-secondary" 
                  style={{ padding: '8px 12px', fontSize: '0.9rem', width: 'auto' }}
                >
                  ▶
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>今日の現場</label>
              <select value={selectedProjectId} onChange={(e) => { setSelectedProjectId(e.target.value); }}>
                <option value="">選択してください</option>
                {projects.filter(p => !p.isDeleted).map(p => <option key={p.id} value={p.id?.toString()}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <div 
                onClick={() => { setIsSummaryOpen(!isSummaryOpen); }} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  cursor: 'pointer',
                  padding: '6px 0',
                  userSelect: 'none'
                }}
              >
                <label style={{ margin: 0, cursor: 'pointer' }}>備考・連絡事項</label>
                <span style={{ fontSize: '0.85rem', color: '#007bff', fontWeight: 'bold' }}>
                  {isSummaryOpen ? '▲ 折りたたむ' : '▼ 入力する（折りたたみ中）'}
                </span>
              </div>
              {isSummaryOpen && (
                <textarea 
                  value={summary} 
                  onChange={(e) => { setSummary(e.target.value); }} 
                  rows={3} 
                  placeholder="特記事項があれば入力" 
                  style={{ marginTop: '8px' }}
                />
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {editingId !== null && (
                <button type="button" onClick={() => { cancelEdit(); }} className="btn btn-secondary" style={{ flex: 1 }}>中止</button>
              )}
              <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                {editingId !== null ? '更新を保存' : '記録を保存'}
              </button>
            </div>
          </form>
        </div>

        <h2>{selectedMonth.replace('-', '年')}月の記録</h2>
        {records.filter(r => r.date.startsWith(selectedMonth)).length === 0 ? <p>記録がありません</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {records.filter(r => r.date.startsWith(selectedMonth)).map(r => {
              const isExpanded = r.id === expandedRecordId;
              // 日付から曜日を取得するヘルパー関数
              const getDayOfWeek = (dateStr: string) => {
                const days = ['日', '月', '火', '水', '木', '金', '土'];
                const d = new Date(dateStr);
                return isNaN(d.getTime()) ? '' : `(${days[d.getDay()]})`;
              };

              return (
                <div 
                  key={r.id} 
                  className="card" 
                  style={{ 
                    padding: '0', 
                    marginBottom: '0',
                    border: '1px solid #e0e0e0',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* ヘッダー部分（常に表示、クリックで開閉） */}
                  <div 
                    onClick={() => { if (r.id !== undefined) setExpandedRecordId(isExpanded ? null : r.id); }}
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '12px 16px', 
                      cursor: 'pointer',
                      backgroundColor: isExpanded ? '#f8f9fa' : 'white',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 'bold', color: '#495057' }}>
                        {r.date.slice(5).replace('-', '/')} {getDayOfWeek(r.date)}
                      </span>
                      <span style={{ color: '#212529', fontWeight: 500 }}>
                        {r.project?.name ?? '(不明)'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.85rem', color: '#007bff', fontWeight: 'bold' }}>
                      {isExpanded ? '▲ 閉じる' : '▼ 詳細'}
                    </span>
                  </div>

                  {/* 詳細部分（展開時のみ表示） */}
                  {isExpanded && (
                    <div style={{ 
                      padding: '16px', 
                      borderTop: '1px solid #eee', 
                      backgroundColor: '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      fontSize: '0.9rem'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div>
                          <strong style={{ color: '#6c757d', marginRight: '8px' }}>人物:</strong>
                          <span>{r.personName}</span>
                        </div>
                        {r.summary ? (
                          <div>
                            <strong style={{ color: '#6c757d', marginRight: '8px' }}>備考:</strong>
                            <span style={{ whiteSpace: 'pre-wrap' }}>{r.summary}</span>
                          </div>
                        ) : (
                          <div style={{ color: '#adb5bd', fontStyle: 'italic' }}>
                            備考はありません
                          </div>
                        )}
                      </div>

                      {/* 操作ボタン */}
                      <div style={{ 
                        display: 'flex', 
                        gap: '8px', 
                        justifyContent: 'flex-end', 
                        borderTop: '1px solid #f1f3f5',
                        paddingTop: '12px',
                        marginTop: '4px'
                      }}>
                        <button 
                          onClick={() => { handleEdit(r); }} 
                          className="btn btn-info" 
                          style={{ padding: '6px 16px', fontSize: '0.8rem', width: 'auto' }}
                        >
                          修正する
                        </button>
                        <button 
                          onClick={() => { 
                            const targetId = r.id;
                            if (targetId !== undefined) {
                              void handleDelete(targetId);
                            }
                          }} 
                          className="btn btn-danger" 
                          style={{ padding: '6px 16px', fontSize: '0.8rem', width: 'auto' }}
                        >
                          削除する
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
