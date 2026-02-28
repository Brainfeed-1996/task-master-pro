import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Context
const AuthContext = createContext<any>(null);

// Types
interface Task {
  _id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  dueDate?: string;
}

// API calls
const API_URL = 'http://localhost:3000/api';

const api = {
  auth: {
    login: (email: string, password: string) => 
      fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      }).then(r => r.json()),
    register: (email: string, password: string) =>
      fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      }).then(r => r.json())
  },
  tasks: {
    getAll: (token: string) =>
      fetch(`${API_URL}/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json()),
    create: (token: string, task: Partial<Task>) =>
      fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(task)
      }).then(r => r.json()),
    update: (token: string, id: string, updates: Partial<Task>) =>
      fetch(`${API_URL}/tasks/${id}`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      }).then(r => r.json()),
    delete: (token: string, id: string) =>
      fetch(`${API_URL}/tasks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json())
  }
};

// Components
const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useContext(AuthContext);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await api.auth.login(email, password);
    if (result.token) login(result.token, result.user);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-2xl w-96">
        <h2 className="text-3xl font-bold mb-6 text-gray-800">TaskMaster Pro</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full p-3 mb-4 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full p-3 mb-6 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg font-semibold hover:bg-blue-700 transition">
          Login
        </button>
      </form>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' as const });
  const { token, user, logout } = useContext(AuthContext);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    const data = await api.tasks.getAll(token);
    setTasks(data);
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.tasks.create(token, newTask);
      setNewTask({ title: '', description: '', priority: 'medium' });
      loadTasks();
    } catch (err: any) {
      if (err.message?.includes('limit')) {
        alert('Upgrade to Premium for unlimited tasks!');
      }
    }
  };

  const toggleTask = async (task: Task) => {
    await api.tasks.update(token, task._id, { completed: !task.completed });
    loadTasks();
  };

  const deleteTask = async (id: string) => {
    await api.tasks.delete(token, id);
    loadTasks();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">TaskMaster Pro</h1>
          <div className="flex items-center gap-4">
            {user?.isPremium ? (
              <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                ⭐ Premium
              </span>
            ) : (
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                Upgrade 9.99€/mois
              </button>
            )}
            <button onClick={logout} className="text-gray-600 hover:text-gray-800">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Add Task Form */}
        <form onSubmit={addTask} className="bg-white p-6 rounded-xl shadow-sm mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Task title"
              value={newTask.title}
              onChange={e => setNewTask({...newTask, title: e.target.value})}
              className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="text"
              placeholder="Description"
              value={newTask.description}
              onChange={e => setNewTask({...newTask, description: e.target.value})}
              className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={newTask.priority}
              onChange={e => setNewTask({...newTask, priority: e.target.value as any})}
              className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
          </div>
          <button type="submit" className="mt-4 w-full md:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
            Add Task
          </button>
        </form>

        {/* Tasks List */}
        <div className="grid gap-4">
          {tasks.map(task => (
            <div key={task._id} className={`bg-white p-6 rounded-xl shadow-sm border-l-4 ${
              task.priority === 'high' ? 'border-red-500' : 
              task.priority === 'medium' ? 'border-yellow-500' : 'border-green-500'
            } ${task.completed ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleTask(task)}
                    className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <div>
                    <h3 className={`text-lg font-semibold ${task.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                      {task.title}
                    </h3>
                    <p className="text-gray-600 text-sm">{task.description}</p>
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                      task.priority === 'high' ? 'bg-red-100 text-red-700' :
                      task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => deleteTask(task._id)}
                  className="text-red-500 hover:text-red-700 p-2"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Free limit info */}
        {!user?.isPremium && (
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
            <p className="text-blue-800 mb-2">Free plan: {tasks.length}/10 tasks used</p>
            <div className="w-full bg-blue-200 rounded-full h-2 mb-4">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{width: `${(tasks.length/10)*100}%`}}></div>
            </div>
            <button className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-8 py-3 rounded-lg font-bold hover:shadow-lg transition">
              Upgrade to Premium - 9.99€/month
            </button>
            <p className="text-sm text-blue-600 mt-2">Unlimited tasks • No ads • Analytics</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Main App
const App: React.FC = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));

  const login = (newToken: string, newUser: any) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      <Router>
        <Routes>
          <Route path="/login" element={!token ? <Login /> : <Navigate to="/" />} />
          <Route path="/" element={token ? <Dashboard /> : <Navigate to="/login" />} />
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
};

export default App;
