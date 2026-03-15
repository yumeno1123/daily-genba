import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as db from '../services/db';

const ProjectList: React.FC = () => {
  const [projects, setProjects] = useState<db.Project[]>([]);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
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

  const handleAdd = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    if (!name) return;
    await db.addProject({ name, location, status: '進行中' });
    setName('');
    setLocation('');
    void fetchProjects();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('この現場を削除しますか？')) return;
    await db.deleteProject(id);
    void fetchProjects();
  };

  if (loading) return <div className="container">読み込み中...</div>;

  return (
    <div className="container">
      <header>
        <h1>現場設定</h1>
        <button onClick={() => { void navigate('/'); }} className="btn btn-secondary">戻る</button>
      </header>

      <main>
        <div className="card">
          <h3>現場の新規登録</h3>
          <form onSubmit={(e) => { void handleAdd(e); }}>
            <div className="form-group">
              <label>現場名 *</label>
              <input type="text" value={name} onChange={(e) => { setName(e.target.value); }} placeholder="例：港区改修工事" />
            </div>
            <div className="form-group">
              <label>場所</label>
              <input type="text" value={location} onChange={(e) => { setLocation(e.target.value); }} placeholder="例：東京都港区..." />
            </div>
            <button type="submit" className="btn btn-success" style={{ width: '100%' }}>現場を追加</button>
          </form>
        </div>

        <h3>登録済み現場</h3>
        {projects.length === 0 ? <p>登録された現場はありません</p> : (
          projects.map(p => (
            <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold' }}>{p.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>{p.location}</div>
              </div>
              <button onClick={() => { 
                const targetId = p.id;
                if (targetId !== undefined) {
                  void handleDelete(targetId);
                }
              }} className="btn btn-danger" style={{ padding: '5px 10px', fontSize: '0.8rem' }}>削除</button>
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default ProjectList;
