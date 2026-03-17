import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'daily-genba-db';
const DB_VERSION = 1;

export interface Project {
  id?: number;
  name: string;
  location: string;
  status: string;
  createdAt: string;
  isDeleted?: boolean;
}

export interface DailyRecord {
  id?: number;
  personName: string;
  date: string;
  projectId: number;
  summary: string;
  createdAt: string;
  project?: Project;
}

export const initDB = async (): Promise<IDBPDatabase> => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('dailyRecords')) {
        db.createObjectStore('dailyRecords', { keyPath: 'id', autoIncrement: true });
      }
    },
  });
};

// 現場操作
export const getProjects = async (): Promise<Project[]> => {
  const db = await initDB();
  return db.getAll('projects') as Promise<Project[]>;
};

export const addProject = async (project: Omit<Project, 'id' | 'createdAt'>): Promise<number> => {
  const db = await initDB();
  return db.add('projects', { ...project, createdAt: new Date().toISOString() }) as Promise<number>;
};

export const updateProject = async (id: number, data: Partial<Project>): Promise<void> => {
  const db = await initDB();
  const project = await db.get('projects', id) as Project | undefined;
  if (!project) return;
  await db.put('projects', { ...project, ...data });
};

export const deleteProject = async (id: number): Promise<void> => {
  const db = await initDB();
  const project = await db.get('projects', id) as Project | undefined;
  if (!project) return;
  await db.put('projects', { ...project, isDeleted: true });
};

// 日報操作
export const getDailyRecords = async (): Promise<DailyRecord[]> => {
  const db = await initDB();
  const records = await db.getAll('dailyRecords') as DailyRecord[];
  const projects = await db.getAll('projects') as Project[];
  
  return records.map(r => ({
    ...r,
    project: projects.find(p => p.id === r.projectId)
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const addDailyRecord = async (record: Omit<DailyRecord, 'id' | 'createdAt'>): Promise<number> => {
  const db = await initDB();
  return db.add('dailyRecords', { ...record, createdAt: new Date().toISOString() }) as Promise<number>;
};

export const updateDailyRecord = async (id: number, data: Partial<DailyRecord>): Promise<void> => {
  const db = await initDB();
  const record = await db.get('dailyRecords', id) as DailyRecord | undefined;
  if (!record) return;
  await db.put('dailyRecords', { ...record, ...data });
};

export const deleteDailyRecord = async (id: number): Promise<void> => {
  const db = await initDB();
  await db.delete('dailyRecords', id);
};
