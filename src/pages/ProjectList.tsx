import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as db from '../services/db';

const ProjectList: React.FC = () => {
  const [projects, setProjects] = useState<db.Project[]>([]);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchProjects = useCallback(async () => {
    const data = await db.getProjects();
    setProjects(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const handleSubmit = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    if (!name) {
      alert('現場名を入力してください');
      return;
    }

    if (editingId !== null) {
      await db.updateProject(editingId, { name, location });
      setEditingId(null);
    } else {
      await db.addProject({ name, location, status: '進行中' });
    }

    setName('');
    setLocation('');
    void fetchProjects();
  };

  const handleEdit = (p: db.Project) => {
    const targetId = p.id;
    if (targetId !== undefined) {
      setEditingId(targetId);
      setName(p.name);
      setLocation(p.location);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('この現場を削除しますか？\n※この現場に関連付けられた日報の現場名が表示されなくなる可能性があります。')) return;
    await db.deleteProject(id);
    void fetchProjects();
  };

  const cancelEdit = () => {
    setEditingId(null);
    setName('');
    setLocation('');
  };

  if (loading) return <div className="container">読み込み中...</div>;

  return (
    <div className="container">
      <header>
        <h1>現場設定</h1>
        <button onClick={() => { void navigate('/'); }} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>戻る</button>
      </header>

      <main>
        <div className="card" style={{ border: editingId !== null ? '2px solid #17a2b8' : 'none' }}>
          <h3>{editingId !== null ? '現場情報を修正' : '現場の新規登録'}</h3>
          <form onSubmit={(e) => { void handleSubmit(e); }}>
            <div className="form-group">
              <label>現場名 *</label>
              <input type="text" value={name} onChange={(e) => { setName(e.target.value); }} placeholder="例：港区改修工事" />
            </div>
            <div className="form-group">
              <label>場所</label>
              <input type="text" value={location} onChange={(e) => { setLocation(e.target.value); }} placeholder="例：東京都港区..." />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {editingId !== null && (
                <button type="button" onClick={() => { cancelEdit(); }} className="btn btn-secondary" style={{ flex: 1 }}>中止</button>
              )}
              <button type="submit" className="btn btn-success" style={{ flex: 2, marginTop: editingId !== null ? '0' : '8px' }}>
                {editingId !== null ? '更新を保存' : '現場を追加'}
              </button>
            </div>
          </form>
        </div>

        <h3>登録済み現場</h3>
        {projects.filter(p => !p.isDeleted).length === 0 ? <p>登録された現場はありません</p> : (
          <div className="card" style={{ padding: '0', overflowX: 'hidden' }}>
            <table className="mobile-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>現場名</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>場所</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {projects.filter(p => !p.isDeleted).map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td data-label="現場名" style={{ padding: '12px', fontWeight: 'bold' }}>{p.name}</td>
                    <td data-label="場所" style={{ padding: '12px' }}>{p.location || '-'}</td>
                    <td data-label="操作" style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { handleEdit(p); }} className="btn btn-info" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>修正</button>
                        <button onClick={() => { 
                          const targetId = p.id;
                          if (targetId !== undefined) {
                            void handleDelete(targetId);
                          }
                        }} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>削除</button>
                      </div>
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

export default ProjectList;
