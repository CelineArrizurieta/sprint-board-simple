import React, { useState, useEffect, useCallback } from 'react';

// Génération des semaines 2026
const generateWeeks = () => {
  const weeks = [];
  const startDate = new Date(2025, 11, 29);
  for (let i = 1; i <= 53; i++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() + (i - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weeks.push({
      num: i,
      start: weekStart,
      end: weekEnd,
      label: `S${i}`,
      dates: `${weekStart.getDate().toString().padStart(2, '0')}/${(weekStart.getMonth() + 1).toString().padStart(2, '0')}`
    });
  }
  return weeks;
};

const WEEKS = generateWeeks();

// Trimestres
const TRIMESTRES = {
  1: WEEKS.filter(w => w.num >= 1 && w.num <= 13),
  2: WEEKS.filter(w => w.num >= 14 && w.num <= 26),
  3: WEEKS.filter(w => w.num >= 27 && w.num <= 39),
  4: WEEKS.filter(w => w.num >= 40 && w.num <= 53),
};

// API URL
const API_URL = '/api/airtable';

// Statuts simplifiés
const STATUTS = [
  { id: 'todo', name: 'À faire', color: '#3B82F6', icon: '📋' },
  { id: 'in_progress', name: 'En cours', color: '#F59E0B', icon: '🔄' },
  { id: 'done', name: 'Terminé', color: '#10B981', icon: '✅' },
];

export default function App() {
  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');

  // Data
  const [projets, setProjets] = useState([]);
  const [axes, setAxes] = useState([]);
  const [chantiers, setChantiers] = useState([]);
  const [collaborateurs, setCollaborateurs] = useState([]);
  
  // UI
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [activeTab, setActiveTab] = useState('planning');
  const [trimestre, setTrimestre] = useState(1);
  
  // Modals
  const [showProjetModal, setShowProjetModal] = useState(false);
  const [editingProjet, setEditingProjet] = useState(null);
  const [newProjet, setNewProjet] = useState({
    name: '',
    chantierId: '',
    weekStart: 1,
    weekEnd: 1,
    collaborateurs: [],
    status: 'todo',
    commentaire: '',
    avancement: 0,
    referentComiteIA: '',
    referentConformite: '',
    meneur: ''
  });
  
  // Filtres
  const [filtreAxe, setFiltreAxe] = useState('');
  const [filtreChantier, setFiltreChantier] = useState('');
  const [searchCollab, setSearchCollab] = useState('');

  // ========== AUTH ==========
  const handleLogin = () => {
    if (passwordInput === 'ApiYou2026') {
      setIsAuthenticated(true);
      localStorage.setItem('sprint_auth', 'true');
    } else {
      alert('Mot de passe incorrect');
    }
  };

  useEffect(() => {
    if (localStorage.getItem('sprint_auth') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // ========== API CALLS ==========
  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [projetsRes, axesRes, chantiersRes, collabsRes] = await Promise.all([
        fetch(`${API_URL}?table=items`),
        fetch(`${API_URL}?table=axes`),
        fetch(`${API_URL}?table=chantiers`),
        fetch(`${API_URL}?table=collaborateurs`),
      ]);

      const projetsData = await projetsRes.json();
      const axesData = await axesRes.json();
      const chantiersData = await chantiersRes.json();
      const collabsData = await collabsRes.json();

      setProjets(projetsData.items || []);
      setAxes(axesData.axes || []);
      setChantiers(chantiersData.chantiers || []);
      setCollaborateurs(collabsData.collaborateurs || []);
      setLastSync(new Date());
    } catch (err) {
      console.error('Erreur:', err);
      setError(`Erreur de chargement: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAll();
    }
  }, [isAuthenticated, fetchAll]);

  // ========== CRUD PROJETS ==========
  const saveProjet = async (projetData) => {
    setIsSaving(true);
    try {
      const method = projetData.id ? 'PUT' : 'POST';
      const response = await fetch(`${API_URL}?table=items`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projetData),
      });
      const data = await response.json();
      
      if (data.item) {
        if (projetData.id) {
          setProjets(prev => prev.map(p => p.id === data.item.id ? data.item : p));
        } else {
          setProjets(prev => [...prev, data.item]);
        }
      }
      setShowProjetModal(false);
      setEditingProjet(null);
      setNewProjet({ 
        name: '', chantierId: '', weekStart: 1, weekEnd: 1, 
        collaborateurs: [], status: 'todo', commentaire: '', avancement: 0,
        referentComiteIA: '', referentConformite: '', meneur: ''
      });
      setLastSync(new Date());
    } catch (err) {
      setError(`Erreur: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProjet = async (id) => {
    if (!confirm('Supprimer ce projet ?')) return;
    setIsSaving(true);
    try {
      await fetch(`${API_URL}?table=items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setProjets(prev => prev.filter(p => p.id !== id));
      setLastSync(new Date());
    } catch (err) {
      setError(`Erreur: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ========== HELPERS ==========
  const getAxeForChantier = (chantierId) => {
    const chantier = chantiers.find(c => c.id === chantierId);
    return axes.find(a => a.id === chantier?.axeId);
  };

  const getChantier = (chantierId) => {
    return chantiers.find(c => c.id === chantierId);
  };

  const getProjetsForWeek = (weekNum, chantierId) => {
    return projets.filter(p => {
      if (p.chantierId !== chantierId) return false;
      const start = p.weekStart || 1;
      const end = p.weekEnd || start;
      return weekNum >= start && weekNum <= end;
    });
  };

  const getCollabName = (collabId) => {
    const collab = collaborateurs.find(c => c.id === collabId);
    return collab?.name || collabId;
  };

  const getCollabColor = (collabId) => {
    const collab = collaborateurs.find(c => c.id === collabId);
    return collab?.color || '#666';
  };

  const getCollab = (collabId) => {
    return collaborateurs.find(c => c.id === collabId);
  };

  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  // Filtres collaborateurs par rôle
  const membresComiteIA = collaborateurs.filter(c => c.estComiteStrategiqueIA);
  const membresConformite = collaborateurs.filter(c => c.estCommissionConformite);
  const meneursPotentiels = collaborateurs.filter(c => c.peutEtreMeneur);
  const directeurs = collaborateurs.filter(c => c.estDirecteur);

  // Grouper collaborateurs par service
  const collabsParService = collaborateurs.reduce((acc, collab) => {
    const service = collab.service || 'Autre';
    if (!acc[service]) acc[service] = [];
    acc[service].push(collab);
    return acc;
  }, {});

  // Calculer directeurs concernés à partir de l'équipe sélectionnée
  const getDirecteursConcernes = (equipeIds) => {
    const servicesImpliques = new Set();
    equipeIds.forEach(id => {
      const collab = getCollab(id);
      if (collab?.service) servicesImpliques.add(collab.service);
    });
    return directeurs.filter(d => servicesImpliques.has(d.service));
  };

  // Chantiers filtrés par axe
  const chantiersFiltres = filtreAxe
    ? chantiers.filter(c => c.axeId === filtreAxe)
    : chantiers;

  // Projets filtrés
  const projetsFiltres = projets.filter(p => {
    if (filtreAxe) {
      const chantier = getChantier(p.chantierId);
      if (chantier?.axeId !== filtreAxe) return false;
    }
    if (filtreChantier && p.chantierId !== filtreChantier) return false;
    return true;
  });

  const currentWeeks = TRIMESTRES[trimestre];

  // ========== ÉCRAN LOGIN ==========
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <span className="text-5xl">🚀</span>
            <h1 className="text-2xl font-bold text-gray-800 mt-4">Sprint Board COMEX 2026</h1>
            <p className="text-gray-500">Plan d'action stratégique API & YOU</p>
          </div>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Mot de passe"
            className="w-full p-3 border rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 focus:outline-none"
          />
          <button
            onClick={handleLogin}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            Accéder
          </button>
        </div>
      </div>
    );
  }

  // ========== APP PRINCIPALE ==========
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-700 to-blue-600 text-white p-4 shadow-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-4xl">🚀</span>
            <div>
              <h1 className="text-2xl font-bold">Sprint Board COMEX 2026</h1>
              <p className="text-purple-200 text-sm">
                Plan d'action stratégique API & YOU
                {lastSync && <span className="ml-2">• Sync {formatTime(lastSync)}</span>}
              </p>
            </div>
          </div>
          <button
            onClick={fetchAll}
            disabled={isLoading}
            className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
          >
            {isLoading ? '⏳' : '🔄'} Sync
          </button>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 flex justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white shadow-sm border-b">
        <div className="flex">
          <button
            onClick={() => setActiveTab('planning')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'planning' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            📊 Planning Visuel
          </button>
          <button
            onClick={() => setActiveTab('projets')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'projets' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            📋 Gestion des Projets
          </button>
          <div className="ml-auto px-4 py-3 text-sm text-gray-500">
            {projets.length} projet(s) • {chantiers.length} chantier(s) • {collaborateurs.length} collaborateur(s)
          </div>
        </div>
      </div>

      <div className="p-4">
        {isLoading && projets.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-gray-600">Chargement des données...</p>
          </div>
        ) : (
          <>
            {/* ========== ONGLET PLANNING ========== */}
            {activeTab === 'planning' && (
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                {/* Contrôles */}
                <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
                  <div className="flex items-center gap-4">
                    <span className="font-medium text-gray-700">Trimestre :</span>
                    {[1, 2, 3, 4].map(t => (
                      <button
                        key={t}
                        onClick={() => setTrimestre(t)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          trimestre === t
                            ? 'bg-purple-600 text-white'
                            : 'bg-white border hover:bg-gray-100'
                        }`}
                      >
                        T{t}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={filtreAxe}
                      onChange={(e) => { setFiltreAxe(e.target.value); setFiltreChantier(''); }}
                      className="p-2 border rounded-lg"
                    >
                      <option value="">Tous les axes</option>
                      {axes.map(axe => (
                        <option key={axe.id} value={axe.id}>{axe.icon} {axe.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Grille Planning */}
                <div className="overflow-auto max-h-[70vh]">
                  <table className="w-full border-collapse text-xs">
                    <thead className="sticky top-0 z-20">
                      <tr className="bg-gray-800 text-white">
                        <th className="p-2 text-left w-48 sticky left-0 bg-gray-800">CHANTIER</th>
                        {currentWeeks.map(week => (
                          <th key={week.num} className="p-1 text-center min-w-16 border-l border-gray-700">
                            <div className="font-bold">{week.label}</div>
                            <div className="text-[10px] text-gray-400">{week.dates}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {axes.filter(a => !filtreAxe || a.id === filtreAxe).map(axe => (
                        <React.Fragment key={axe.id}>
                          {/* En-tête Axe */}
                          <tr style={{ backgroundColor: axe.color }}>
                            <td
                              className="p-2 font-bold text-white sticky left-0"
                              style={{ backgroundColor: axe.color }}
                              colSpan={currentWeeks.length + 1}
                            >
                              {axe.icon} {axe.name}
                            </td>
                          </tr>
                          
                          {/* Chantiers de l'axe */}
                          {chantiers
                            .filter(c => c.axeId === axe.id)
                            .map(chantier => (
                              <tr key={chantier.id} className="border-b hover:bg-gray-50">
                                <td className="p-2 text-sm font-medium sticky left-0 bg-white border-r">
                                  {chantier.name}
                                </td>
                                {currentWeeks.map(week => {
                                  const weekProjets = getProjetsForWeek(week.num, chantier.id);
                                  return (
                                    <td
                                      key={week.num}
                                      className="p-0 border-l cursor-pointer hover:bg-purple-50 transition-colors relative"
                                      onClick={() => {
                                        setNewProjet({
                                          name: '',
                                          chantierId: chantier.id,
                                          weekStart: week.num,
                                          weekEnd: week.num,
                                          collaborateurs: [],
                                          status: 'todo',
                                          commentaire: '',
                                          avancement: 0,
                                          referentComiteIA: '',
                                          referentConformite: '',
                                          meneur: ''
                                        });
                                        setEditingProjet(null);
                                        setShowProjetModal(true);
                                      }}
                                    >
                                      {weekProjets.map(projet => {
                                        const statut = STATUTS.find(s => s.id === projet.status);
                                        return (
                                          <div
                                            key={projet.id}
                                            className="text-[9px] p-1 m-0.5 rounded text-white truncate"
                                            style={{ backgroundColor: statut?.color || '#666' }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setEditingProjet(projet);
                                              setShowProjetModal(true);
                                            }}
                                            title={`${projet.name} (S${projet.weekStart}-S${projet.weekEnd})`}
                                          >
                                            {projet.name}
                                          </div>
                                        );
                                      })}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Légende */}
                <div className="p-4 bg-gray-50 border-t flex items-center gap-6">
                  <span className="font-medium text-gray-700">Légende :</span>
                  {STATUTS.map(statut => (
                    <div key={statut.id} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: statut.color }}></div>
                      <span className="text-sm">{statut.icon} {statut.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ========== ONGLET GESTION PROJETS ========== */}
            {activeTab === 'projets' && (
              <div className="space-y-4">
                {/* Filtres et bouton ajouter */}
                <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <select
                      value={filtreAxe}
                      onChange={(e) => { setFiltreAxe(e.target.value); setFiltreChantier(''); }}
                      className="p-2 border rounded-lg"
                    >
                      <option value="">Tous les axes</option>
                      {axes.map(axe => (
                        <option key={axe.id} value={axe.id}>{axe.icon} {axe.name}</option>
                      ))}
                    </select>
                    <select
                      value={filtreChantier}
                      onChange={(e) => setFiltreChantier(e.target.value)}
                      className="p-2 border rounded-lg"
                    >
                      <option value="">Tous les chantiers</option>
                      {chantiersFiltres.map(ch => (
                        <option key={ch.id} value={ch.id}>{ch.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      setNewProjet({
                        name: '',
                        chantierId: chantiers[0]?.id || '',
                        weekStart: 1,
                        weekEnd: 1,
                        collaborateurs: [],
                        status: 'todo',
                        commentaire: '',
                        avancement: 0,
                        referentComiteIA: '',
                        referentConformite: '',
                        meneur: ''
                      });
                      setEditingProjet(null);
                      setShowProjetModal(true);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                  >
                    ➕ Nouveau projet
                  </button>
                </div>

                {/* Liste par chantier */}
                {(filtreChantier ? [chantiers.find(c => c.id === filtreChantier)] : chantiersFiltres)
                  .filter(Boolean)
                  .map(chantier => {
                    const axe = getAxeForChantier(chantier.id);
                    const chantierProjets = projetsFiltres.filter(p => p.chantierId === chantier.id);
                    
                    if (chantierProjets.length === 0 && filtreChantier !== chantier.id) return null;
                    
                    return (
                      <div key={chantier.id} className="bg-white rounded-lg shadow overflow-hidden">
                        {/* En-tête chantier */}
                        <div
                          className="p-3 text-white font-bold flex items-center justify-between"
                          style={{ backgroundColor: axe?.color || '#666' }}
                        >
                          <span>{axe?.icon} {chantier.name}</span>
                          <span className="text-sm font-normal opacity-80">
                            {chantierProjets.length} projet(s)
                          </span>
                        </div>
                        
                        {/* Liste projets */}
                        {chantierProjets.length === 0 ? (
                          <div className="p-8 text-center text-gray-400">
                            Aucun projet dans ce chantier
                          </div>
                        ) : (
                          <div className="divide-y">
                            {chantierProjets.map(projet => {
                              const statut = STATUTS.find(s => s.id === projet.status);
                              const collabs = projet.collaborateurs || [];
                              const meneur = getCollab(projet.meneur);
                              
                              return (
                                <div key={projet.id} className="p-4 hover:bg-gray-50 flex items-center gap-4">
                                  {/* Statut */}
                                  <div
                                    className="w-3 h-12 rounded"
                                    style={{ backgroundColor: statut?.color }}
                                    title={statut?.name}
                                  />
                                  
                                  {/* Infos */}
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-800">{projet.name}</div>
                                    {projet.commentaire && (
                                      <div className="text-sm text-gray-500 mt-1 italic">
                                        💬 {projet.commentaire.length > 80 ? projet.commentaire.substring(0, 80) + '...' : projet.commentaire}
                                      </div>
                                    )}
                                    <div className="text-sm text-gray-500 flex items-center gap-4 mt-1 flex-wrap">
                                      <span>📅 S{projet.weekStart}{projet.weekEnd !== projet.weekStart ? ` → S${projet.weekEnd}` : ''}</span>
                                      <span
                                        className="px-2 py-0.5 rounded text-white text-xs"
                                        style={{ backgroundColor: statut?.color }}
                                      >
                                        {statut?.icon} {statut?.name}
                                      </span>
                                      {projet.avancement > 0 && (
                                        <span className="flex items-center gap-1">
                                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div 
                                              className="h-full bg-green-500 rounded-full"
                                              style={{ width: `${projet.avancement}%` }}
                                            />
                                          </div>
                                          <span className="text-xs text-gray-500">{projet.avancement}%</span>
                                        </span>
                                      )}
                                      {meneur && (
                                        <span className="text-xs">
                                          🏅 Meneur: <strong>{meneur.name}</strong>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Collaborateurs */}
                                  <div className="flex items-center gap-1 flex-wrap max-w-xs">
                                    {collabs.length > 0 ? (
                                      collabs.slice(0, 4).map(collabId => (
                                        <span
                                          key={collabId}
                                          className="px-2 py-1 rounded text-white text-xs"
                                          style={{ backgroundColor: getCollabColor(collabId) }}
                                        >
                                          {getCollabName(collabId)}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-gray-400 text-sm">Non assigné</span>
                                    )}
                                    {collabs.length > 4 && (
                                      <span className="text-xs text-gray-500">+{collabs.length - 4}</span>
                                    )}
                                  </div>
                                  
                                  {/* Actions */}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        setEditingProjet(projet);
                                        setShowProjetModal(true);
                                      }}
                                      className="p-2 text-blue-500 hover:bg-blue-50 rounded"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => deleteProjet(projet.id)}
                                      className="p-2 text-red-500 hover:bg-red-50 rounded"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ========== MODAL PROJET ========== */}
      {showProjetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <h3 className="text-xl font-bold p-6 pb-4 border-b">
              {editingProjet ? '✏️ Modifier le projet' : '➕ Nouveau projet'}
            </h3>
            
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {/* Nom */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du projet *</label>
                <input
                  type="text"
                  value={editingProjet?.name || newProjet.name}
                  onChange={(e) => editingProjet
                    ? setEditingProjet({ ...editingProjet, name: e.target.value })
                    : setNewProjet({ ...newProjet, name: e.target.value })
                  }
                  placeholder="Ex: Migration base de données"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Chantier */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chantier *</label>
                <select
                  value={editingProjet?.chantierId || newProjet.chantierId}
                  onChange={(e) => editingProjet
                    ? setEditingProjet({ ...editingProjet, chantierId: e.target.value })
                    : setNewProjet({ ...newProjet, chantierId: e.target.value })
                  }
                  className="w-full p-3 border rounded-lg"
                >
                  <option value="">-- Sélectionner --</option>
                  {axes.map(axe => (
                    <optgroup key={axe.id} label={`${axe.icon} ${axe.name}`}>
                      {chantiers.filter(c => c.axeId === axe.id).map(ch => (
                        <option key={ch.id} value={ch.id}>{ch.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Semaines */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semaine début</label>
                  <select
                    value={editingProjet?.weekStart || newProjet.weekStart}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (editingProjet) {
                        setEditingProjet({ ...editingProjet, weekStart: val, weekEnd: Math.max(val, editingProjet.weekEnd || val) });
                      } else {
                        setNewProjet({ ...newProjet, weekStart: val, weekEnd: Math.max(val, newProjet.weekEnd) });
                      }
                    }}
                    className="w-full p-3 border rounded-lg"
                  >
                    {WEEKS.map(w => (
                      <option key={w.num} value={w.num}>S{w.num} ({w.dates})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semaine fin</label>
                  <select
                    value={editingProjet?.weekEnd || newProjet.weekEnd}
                    onChange={(e) => editingProjet
                      ? setEditingProjet({ ...editingProjet, weekEnd: parseInt(e.target.value) })
                      : setNewProjet({ ...newProjet, weekEnd: parseInt(e.target.value) })
                    }
                    className="w-full p-3 border rounded-lg"
                  >
                    {WEEKS.filter(w => w.num >= (editingProjet?.weekStart || newProjet.weekStart)).map(w => (
                      <option key={w.num} value={w.num}>S{w.num} ({w.dates})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Statut */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                <div className="flex gap-2">
                  {STATUTS.map(statut => (
                    <button
                      key={statut.id}
                      type="button"
                      onClick={() => editingProjet
                        ? setEditingProjet({ ...editingProjet, status: statut.id })
                        : setNewProjet({ ...newProjet, status: statut.id })
                      }
                      className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                        (editingProjet?.status || newProjet.status) === statut.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-1">{statut.icon}</div>
                      <div className="text-xs font-medium">{statut.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Avancement */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Avancement : {editingProjet?.avancement || newProjet.avancement || 0}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={editingProjet?.avancement || newProjet.avancement || 0}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (editingProjet) {
                      setEditingProjet({ ...editingProjet, avancement: val });
                    } else {
                      setNewProjet({ ...newProjet, avancement: val });
                    }
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* ========== SECTION ÉQUIPE DU CYCLE ========== */}
              <div className="border-t pt-4 mt-4">
                <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  👥 Équipe du cycle
                </h4>

                {/* Gouvernance du cycle */}
                <div className="bg-purple-50 rounded-lg p-4 mb-4">
                  <h5 className="text-sm font-semibold text-purple-800 mb-3">🧭 GOUVERNANCE DU CYCLE</h5>
                  
                  {/* Référent Comité Stratégique IA */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      🎯 Référent Comité Stratégique IA
                    </label>
                    <select
                      value={editingProjet?.referentComiteIA || newProjet.referentComiteIA || ''}
                      onChange={(e) => editingProjet
                        ? setEditingProjet({ ...editingProjet, referentComiteIA: e.target.value })
                        : setNewProjet({ ...newProjet, referentComiteIA: e.target.value })
                      }
                      className="w-full p-2 border rounded-lg text-sm"
                    >
                      <option value="">-- Sélectionner --</option>
                      {membresComiteIA.map(collab => (
                        <option key={collab.id} value={collab.id}>
                          {collab.name} {collab.nomComplet !== collab.name ? `(${collab.nomComplet})` : ''} - {collab.role}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Rémi, Séverine, Céline, Michel</p>
                  </div>

                  {/* Référent Commission Conformité */}
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      🔒 Référent Commission Conformité
                    </label>
                    <select
                      value={editingProjet?.referentConformite || newProjet.referentConformite || ''}
                      onChange={(e) => editingProjet
                        ? setEditingProjet({ ...editingProjet, referentConformite: e.target.value })
                        : setNewProjet({ ...newProjet, referentConformite: e.target.value })
                      }
                      className="w-full p-2 border rounded-lg text-sm"
                    >
                      <option value="">-- Sélectionner --</option>
                      {membresConformite.map(collab => (
                        <option key={collab.id} value={collab.id}>
                          {collab.name} {collab.nomComplet !== collab.name ? `(${collab.nomComplet})` : ''} - {collab.role}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Sylvain, Emmanuel, Rémi, Stéphane D., Damien, Geoffrey</p>
                  </div>

                  {/* Meneur */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      🏅 Meneur (Coordinateur)
                    </label>
                    <select
                      value={editingProjet?.meneur || newProjet.meneur || ''}
                      onChange={(e) => editingProjet
                        ? setEditingProjet({ ...editingProjet, meneur: e.target.value })
                        : setNewProjet({ ...newProjet, meneur: e.target.value })
                      }
                      className="w-full p-2 border rounded-lg text-sm"
                    >
                      <option value="">-- Sélectionner --</option>
                      {Object.entries(collabsParService).map(([service, collabs]) => (
                        <optgroup key={service} label={service}>
                          {collabs.filter(c => c.peutEtreMeneur).map(collab => (
                            <option key={collab.id} value={collab.id}>
                              {collab.name} - {collab.role}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Tout collaborateur peut être meneur</p>
                  </div>
                </div>

                {/* Équipe de cycle */}
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <h5 className="text-sm font-semibold text-blue-800 mb-3">🏃 ÉQUIPE DE CYCLE (3-7 personnes)</h5>
                  
                  {/* Recherche */}
                  <input
                    type="text"
                    placeholder="🔍 Rechercher un collaborateur..."
                    value={searchCollab}
                    onChange={(e) => setSearchCollab(e.target.value)}
                    className="w-full p-2 border rounded-lg text-sm mb-3"
                  />

                  {/* Liste par service */}
                  <div className="max-h-60 overflow-y-auto space-y-3">
                    {Object.entries(collabsParService).map(([service, collabs]) => {
                      const filteredCollabs = collabs.filter(c => 
                        !searchCollab || 
                        c.name.toLowerCase().includes(searchCollab.toLowerCase()) ||
                        c.nomComplet?.toLowerCase().includes(searchCollab.toLowerCase())
                      );
                      if (filteredCollabs.length === 0) return null;
                      
                      return (
                        <div key={service}>
                          <div className="text-xs font-semibold text-gray-600 mb-1 flex items-center gap-2">
                            📂 {service} ({filteredCollabs.length})
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {filteredCollabs.map(collab => {
                              const currentCollabs = editingProjet?.collaborateurs || newProjet.collaborateurs || [];
                              const isSelected = currentCollabs.includes(collab.id);
                              return (
                                <button
                                  key={collab.id}
                                  type="button"
                                  onClick={() => {
                                    const updated = isSelected
                                      ? currentCollabs.filter(id => id !== collab.id)
                                      : [...currentCollabs, collab.id];
                                    
                                    if (editingProjet) {
                                      setEditingProjet({ ...editingProjet, collaborateurs: updated });
                                    } else {
                                      setNewProjet({ ...newProjet, collaborateurs: updated });
                                    }
                                  }}
                                  className={`px-2 py-1 rounded text-xs transition-all ${
                                    isSelected
                                      ? 'text-white'
                                      : 'bg-white border text-gray-700 hover:bg-gray-100'
                                  }`}
                                  style={isSelected ? { backgroundColor: collab.color } : {}}
                                  title={`${collab.nomComplet || collab.name} - ${collab.role}`}
                                >
                                  {collab.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Compteur */}
                  <div className="mt-3 text-xs text-gray-600">
                    {(editingProjet?.collaborateurs || newProjet.collaborateurs || []).length} collaborateur(s) sélectionné(s)
                    {(editingProjet?.collaborateurs || newProjet.collaborateurs || []).length < 3 && (
                      <span className="text-orange-500 ml-2">⚠️ Minimum recommandé : 3</span>
                    )}
                    {(editingProjet?.collaborateurs || newProjet.collaborateurs || []).length > 7 && (
                      <span className="text-orange-500 ml-2">⚠️ Maximum recommandé : 7</span>
                    )}
                  </div>
                </div>

                {/* Directeurs concernés (automatique) */}
                {(() => {
                  const currentCollabs = editingProjet?.collaborateurs || newProjet.collaborateurs || [];
                  const directeursConcernes = getDirecteursConcernes(currentCollabs);
                  
                  if (directeursConcernes.length === 0) return null;
                  
                  return (
                    <div className="bg-gray-100 rounded-lg p-4">
                      <h5 className="text-sm font-semibold text-gray-700 mb-2">📋 DIRECTEURS CONCERNÉS (automatique)</h5>
                      <div className="flex flex-wrap gap-2">
                        {directeursConcernes.map(dir => (
                          <span
                            key={dir.id}
                            className="px-3 py-1 rounded-lg text-white text-sm"
                            style={{ backgroundColor: dir.color }}
                          >
                            {dir.name}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Déduit automatiquement des services de l'équipe sélectionnée
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* Commentaire */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire</label>
                <textarea
                  value={editingProjet?.commentaire || newProjet.commentaire || ''}
                  onChange={(e) => editingProjet
                    ? setEditingProjet({ ...editingProjet, commentaire: e.target.value })
                    : setNewProjet({ ...newProjet, commentaire: e.target.value })
                  }
                  placeholder="Notes, précisions, liens utiles..."
                  rows={3}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Boutons - toujours visibles */}
            <div className="flex gap-3 p-6 pt-4 border-t bg-white rounded-b-xl">
              <button
                onClick={() => {
                  setShowProjetModal(false);
                  setEditingProjet(null);
                  setSearchCollab('');
                }}
                className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  const data = editingProjet || newProjet;
                  if (!data.name || !data.chantierId) {
                    alert('Veuillez remplir le nom et le chantier');
                    return;
                  }
                  saveProjet(data);
                }}
                disabled={isSaving}
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {isSaving ? '⏳ Enregistrement...' : (editingProjet ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
