import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as db from '../services/db';

const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<db.Project[]>([]);
  const [records, setRecords] = useState<db.DailyRecord[]>([]);
  const [personName, setPersonName] = useState(localStorage.getItem('personName') ?? '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [summary, setSummary] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    const [p, r] = await Promise.all([db.getProjects(), db.getDailyRecords()]);
    setProjects(p);
    setRecords(r);
    setLoading(false);
  }, []);

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
        // 編集モードではないが、既存データがあることを示すためにあえてセットする
      } else {
        // 既存記録がない場合は、備考のみクリア（現場は継続の可能性があるため残す選択もありですが、一旦クリアします）
        setSummary('');
      }
    }
  }, [date, personName, records, loading, editingId]);

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
            alert('既存の記録を上書き更新しました');
            setSummary('');
            void fetchData();
          }
          return;
        } else {
          return;
        }
      }
    }

    if (editingId !== null) {
      await db.updateDailyRecord(editingId, {
        personName,
        date,
        projectId: parseInt(selectedProjectId),
        summary
      });
      setEditingId(null);
      alert('更新しました');
    } else {
      await db.addDailyRecord({
        personName,
        date,
        projectId: parseInt(selectedProjectId),
        summary
      });
      alert('記録しました');
    }

    setSummary('');
    void fetchData();
  };

  const handleEdit = (r: db.DailyRecord) => {
    const targetId = r.id;
    if (targetId !== undefined) {
      setEditingId(targetId);
      setPersonName(r.personName);
      setDate(r.date);
      setSelectedProjectId(r.projectId.toString());
      setSummary(r.summary);
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
  };

  const handleExport = () => {
    if (records.length === 0) return;
    const filteredRecords = records.filter(r => r.date.startsWith(selectedMonth));
    if (filteredRecords.length === 0) {
      alert(`${selectedMonth} の記録はありません`);
      return;
    }
    const sortedRecords = [...filteredRecords].sort((a, b) => a.date.localeCompare(b.date));
    const header = '日付,人物,現場名,備考\n';
    const csv = sortedRecords.map(r => {
      return `"${r.date}","${r.personName}","${r.project?.name ?? '不明'}","${r.summary}"`;
    }).join('\n');
    
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select 
            value={selectedMonth} 
            onChange={(e) => { setSelectedMonth(e.target.value); }}
            style={{ padding: '4px', fontSize: '0.8rem', width: 'auto' }}
          >
            {Array.from(new Set(records.map(r => r.date.slice(0, 7)))).sort().reverse().map(m => (
              <option key={m} value={m}>{m.replace('-', '年') + '月'}</option>
            ))}
            {!records.some(r => r.date.startsWith(new Date().toISOString().slice(0, 7))) && (
              <option value={new Date().toISOString().slice(0, 7)}>{new Date().toISOString().slice(0, 7).replace('-', '年') + '月'}</option>
            )}
          </select>
          <button onClick={() => { void navigate('/projects'); }} className="btn btn-info" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>現場設定</button>
          <button onClick={() => { handleExport(); }} className="btn btn-success" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>CSV出力</button>
        </div>
      </header>

      <main>
        <div className="card" style={{ border: editingId !== null ? '2px solid #17a2b8' : 'none' }}>
          <h2>{editingId !== null ? '記録を修正する' : '今日の情報を記録する'}</h2>
          <form onSubmit={(e) => { void handleSubmit(e); }}>
            <div className="form-group">
              <label>人物名</label>
              <input 
                type="text" 
                value={personName} 
                onChange={(e) => { setPersonName(e.target.value); }} 
                placeholder="あなたの名前"
              />
            </div>
            <div className="form-group">
              <label>日付</label>
              <input type="date" value={date} onChange={(e) => { setDate(e.target.value); }} />
            </div>
            <div className="form-group">
              <label>今日の現場</label>
              <select value={selectedProjectId} onChange={(e) => { setSelectedProjectId(e.target.value); }}>
                <option value="">選択してください</option>
                {projects.map(p => <option key={p.id} value={p.id?.toString()}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>備考・連絡事項</label>
              <textarea value={summary} onChange={(e) => { setSummary(e.target.value); }} rows={3} placeholder="特記事項があれば入力" />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {editingId !== null && (
                <button type="button" onClick={() => { cancelEdit(); }} className="btn btn-secondary" style={{ flex: 1 }}>キャンセル</button>
              )}
              <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>
                {editingId !== null ? '更新を保存する' : '記録を保存'}
              </button>
            </div>
          </form>
        </div>

        <h2>最近の記録</h2>
        {records.length === 0 ? <p>記録がありません</p> : (
          <div className="card" style={{ padding: '0', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>日付</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>人物</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>現場名</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{r.date}</td>
                    <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{r.personName}</td>
                    <td style={{ padding: '10px' }}>{r.project?.name ?? '(不明)'}</td>
                    <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => { handleEdit(r); }} className="btn btn-info" style={{ padding: '4px 8px', fontSize: '0.7rem', marginRight: '5px' }}>修正</button>
                      <button onClick={() => { 
                        const targetId = r.id;
                        if (targetId !== undefined) {
                          void handleDelete(targetId);
                        }
                      }} className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.7rem' }}>削除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
