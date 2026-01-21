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

const TRIMESTRES = {
  1: WEEKS.filter(w => w.num >= 1 && w.num <= 13),
  2: WEEKS.filter(w => w.num >= 14 && w.num <= 26),
  3: WEEKS.filter(w => w.num >= 27 && w.num <= 39),
  4: WEEKS.filter(w => w.num >= 40 && w.num <= 53),
};

const API_URL = '/api/airtable';

const STATUTS = [
  { id: 'todo', name: 'À faire', color: '#3B82F6', icon: '📋' },
  { id: 'in_progress', name: 'En cours', color: '#F59E0B', icon: '🔄' },
  { id: 'done', name: 'Terminé', color: '#10B981', icon: '✅' },
];

const SPRINTS = ['Sprint 1', 'Sprint 2', 'Sprint 3', 'Sprint 4', 'Backlog'];

// Pôles pour la vue Équipage (sans icônes)
const POLES = {
  'Présidence': { color: '#7C3AED', bgLight: '#F3E8FF' },
  'Direction': { color: '#7C3AED', bgLight: '#F3E8FF' }, // Alias vers Présidence
  'Direction Générale': { color: '#8B5CF6', bgLight: '#EDE9FE' },
  'Conseil': { color: '#6366F1', bgLight: '#E0E7FF' },
  'Informatique': { color: '#3B82F6', bgLight: '#DBEAFE' },
  'Datacenter': { color: '#0EA5E9', bgLight: '#E0F2FE' },
  'Production': { color: '#F59E0B', bgLight: '#FEF3C7' },
  'Production & Innovation': { color: '#8B5CF6', bgLight: '#EDE9FE' },
  'Animation': { color: '#EC4899', bgLight: '#FCE7F3' },
  'Innovation': { color: '#8B5CF6', bgLight: '#EDE9FE' },
  'Développement Commercial': { color: '#10B981', bgLight: '#D1FAE5' },
  'Développement et Marketing': { color: '#10B981', bgLight: '#D1FAE5' },
  'Communication': { color: '#F97316', bgLight: '#FFEDD5' },
  'Admin & RH': { color: '#64748B', bgLight: '#F1F5F9' },
  'Autre': { color: '#6B7280', bgLight: '#F3F4F6' },
};

// Mapping pour renommer certains pôles à l'affichage
const POLES_DISPLAY_NAME = {
  'Direction': 'Présidence', // "Direction" dans Airtable → affiche "Présidence"
};

const POLES_ORDER = [
  'Présidence', 'Direction', 'Direction Générale', 'Conseil', 'Production & Innovation', 'Innovation',
  'Informatique', 'Datacenter', 'Production', 'Animation', 
  'Développement Commercial', 'Développement et Marketing', 'Communication', 'Admin & RH', 'Autre'
];

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [projets, setProjets] = useState([]);
  const [axes, setAxes] = useState([]);
  const [chantiers, setChantiers] = useState([]);
  const [collaborateurs, setCollaborateurs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [activeTab, setActiveTab] = useState('planning');
  const [trimestre, setTrimestre] = useState(1);
  const [selectedProjet, setSelectedProjet] = useState(null);
  const [projetTaches, setProjetTaches] = useState([]);
  const [loadingTaches, setLoadingTaches] = useState(false);
  const [showProjetModal, setShowProjetModal] = useState(false);
  const [showTacheModal, setShowTacheModal] = useState(false);
  const [editingProjet, setEditingProjet] = useState(null);
  const [editingTache, setEditingTache] = useState(null);
  const [newProjet, setNewProjet] = useState({
    name: '', chantierId: '', weekStart: 1, weekEnd: 1,
    collaborateurs: [], status: 'todo', commentaire: '', avancement: 0,
    objectif: '', referentComiteIA: '', referentConformite: '', meneur: ''
  });
  const [newTache, setNewTache] = useState({
    name: '', projetId: '', sprint: 'Sprint 1', assigne: '',
    dureeEstimee: 0, heuresReelles: 0, status: 'todo', commentaire: ''
  });
  const [filtreAxe, setFiltreAxe] = useState('');
  const [filtreChantier, setFiltreChantier] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  
  // Drag and Drop state
  const [draggedTache, setDraggedTache] = useState(null);
  const [dragOverSprint, setDragOverSprint] = useState(null);
  
  // Documents state
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [newDocument, setNewDocument] = useState({ name: '', url: '', type: 'onedrive' });
  const [savingDocument, setSavingDocument] = useState(false);
  
  // Équipage state
  const [equipageSearch, setEquipageSearch] = useState('');
  const [equipagePoleFilter, setEquipagePoleFilter] = useState('');
  const [equipageRoleFilter, setEquipageRoleFilter] = useState('');
  const [selectedCollaborateur, setSelectedCollaborateur] = useState(null);

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
      setError(`Erreur de chargement: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTachesForProjet = useCallback(async (projetId) => {
    setLoadingTaches(true);
    try {
      const res = await fetch(`${API_URL}?table=taches&projetId=${projetId}`);
      const data = await res.json();
      setProjetTaches(data.taches || []);
    } catch (err) {
      setProjetTaches([]);
    } finally {
      setLoadingTaches(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) fetchAll();
  }, [isAuthenticated, fetchAll]);

  useEffect(() => {
    if (selectedProjet) fetchTachesForProjet(selectedProjet.id);
  }, [selectedProjet, fetchTachesForProjet]);

  const saveProjet = async (projetData) => {
    setIsSaving(true);
    try {
      const method = projetData.id ? 'PUT' : 'POST';
      const response = await fetch(`${API_URL}?table=items`, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projetData),
      });
      const data = await response.json();
      if (data.item) {
        if (projetData.id) {
          setProjets(prev => prev.map(p => p.id === data.item.id ? data.item : p));
          if (selectedProjet?.id === data.item.id) setSelectedProjet(data.item);
        } else {
          setProjets(prev => [...prev, data.item]);
        }
      }
      setShowProjetModal(false);
      setEditingProjet(null);
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
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setProjets(prev => prev.filter(p => p.id !== id));
      if (selectedProjet?.id === id) setSelectedProjet(null);
      setLastSync(new Date());
    } catch (err) {
      setError(`Erreur: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const saveTache = async (tacheData) => {
    setIsSaving(true);
    try {
      const method = tacheData.id ? 'PUT' : 'POST';
      console.log('Saving tache:', JSON.stringify(tacheData));
      const response = await fetch(`${API_URL}?table=taches`, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tacheData),
      });
      const data = await response.json();
      console.log('API response:', JSON.stringify(data));
      
      // Vérifier les erreurs
      if (data.error) {
        setError(`Erreur Airtable: ${data.error}`);
        return;
      }
      
      if (data.tache) {
        if (tacheData.id) {
          setProjetTaches(prev => prev.map(t => t.id === data.tache.id ? data.tache : t));
        } else {
          setProjetTaches(prev => [...prev, data.tache]);
        }
        setShowTacheModal(false);
        setEditingTache(null);
      } else {
        setError('Erreur: Aucune tâche retournée par l\'API');
      }
    } catch (err) {
      console.error('Save tache error:', err);
      setError(`Erreur: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTache = async (id) => {
    if (!confirm('Supprimer cette tâche ?')) return;
    try {
      await fetch(`${API_URL}?table=taches`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setProjetTaches(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setError(`Erreur: ${err.message}`);
    }
  };

  const toggleTacheStatus = async (tache) => {
    const newStatus = tache.status === 'done' ? 'todo' : 'done';
    await saveTache({ ...tache, status: newStatus });
  };

  // Document handlers
  const addDocument = async (projetId, docData) => {
    setSavingDocument(true);
    try {
      const response = await fetch(`${API_URL}?table=documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projetId, ...docData }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      // Mettre à jour le projet local avec les nouveaux documents
      setProjets(prev => prev.map(p => 
        p.id === projetId ? { ...p, documents: data.documents } : p
      ));
      if (selectedProjet?.id === projetId) {
        setSelectedProjet(prev => ({ ...prev, documents: data.documents }));
      }
      setShowDocumentModal(false);
      setNewDocument({ name: '', url: '', type: 'onedrive' });
    } catch (err) {
      setError(`Erreur: ${err.message}`);
    } finally {
      setSavingDocument(false);
    }
  };

  const deleteDocument = async (projetId, documentId) => {
    if (!confirm('Supprimer ce document ?')) return;
    try {
      const response = await fetch(`${API_URL}?table=documents`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projetId, documentId }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      // Mettre à jour le projet local
      setProjets(prev => prev.map(p => 
        p.id === projetId ? { ...p, documents: data.documents } : p
      ));
      if (selectedProjet?.id === projetId) {
        setSelectedProjet(prev => ({ ...prev, documents: data.documents }));
      }
    } catch (err) {
      setError(`Erreur: ${err.message}`);
    }
  };

  const getDocumentIcon = (type, url) => {
    if (type === 'onedrive' || url?.includes('onedrive') || url?.includes('sharepoint')) return '📘';
    if (type === 'gdrive' || url?.includes('drive.google')) return '📗';
    if (type === 'notion' || url?.includes('notion')) return '📓';
    if (url?.includes('.pdf')) return '📕';
    if (url?.includes('.doc') || url?.includes('.docx')) return '📄';
    if (url?.includes('.xls') || url?.includes('.xlsx')) return '📊';
    if (url?.includes('.ppt') || url?.includes('.pptx')) return '📽️';
    return '🔗';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Drag and Drop handlers
  const handleDragStart = (e, tache) => {
    setDraggedTache(tache);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tache.id);
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedTache(null);
    setDragOverSprint(null);
  };

  const handleDragOver = (e, sprint) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSprint(sprint);
  };

  const handleDrop = async (e, targetSprint) => {
    e.preventDefault();
    setDragOverSprint(null);
    if (draggedTache && draggedTache.sprint !== targetSprint) {
      await saveTache({ ...draggedTache, sprint: targetSprint });
    }
    setDraggedTache(null);
  };

  const getAxeForChantier = (chantierId) => {
    const chantier = chantiers.find(c => c.id === chantierId);
    return axes.find(a => a.id === chantier?.axeId);
  };
  const getChantier = (chantierId) => chantiers.find(c => c.id === chantierId);
  // Recherche collaborateur par id OU recordId (pour compatibilité Airtable Linked Records)
  const getCollab = (collabId) => {
    if (!collabId) return null;
    return collaborateurs.find(c => c.id === collabId || c.recordId === collabId);
  };
  const getProjetsForWeek = (weekNum, chantierId) => projets.filter(p => {
    if (p.chantierId !== chantierId) return false;
    return weekNum >= (p.weekStart || 1) && weekNum <= (p.weekEnd || p.weekStart || 1);
  });
  const formatTime = (date) => date ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

  const currentWeeks = TRIMESTRES[trimestre] || [];
  const chantiersFiltres = filtreAxe ? chantiers.filter(c => c.axeId === filtreAxe) : chantiers;
  const projetsFiltres = projets.filter(p => {
    if (filtreAxe && getAxeForChantier(p.chantierId)?.id !== filtreAxe) return false;
    if (filtreChantier && p.chantierId !== filtreChantier) return false;
    if (filtreStatut && p.status !== filtreStatut) return false;
    return true;
  });

  const collabsParService = collaborateurs.reduce((acc, c) => {
    const service = c.service || 'Autre';
    if (!acc[service]) acc[service] = [];
    acc[service].push(c);
    return acc;
  }, {});

  const membresComiteIA = collaborateurs.filter(c => c.estComiteStrategiqueIA);
  const membresConformite = collaborateurs.filter(c => c.estCommissionConformite);

  const getTachesBySprint = (sprint) => projetTaches.filter(t => t.sprint === sprint);
  const getSprintStats = (sprint) => {
    const taches = getTachesBySprint(sprint);
    const done = taches.filter(t => t.status === 'done').length;
    const heuresEstimees = taches.reduce((sum, t) => sum + (t.dureeEstimee || 0), 0);
    const heuresReelles = taches.reduce((sum, t) => sum + (t.heuresReelles || 0), 0);
    return { total: taches.length, done, heuresEstimees, heuresReelles, progress: taches.length ? Math.round((done / taches.length) * 100) : 0 };
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-700 to-blue-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <span className="text-6xl">🚀</span>
            <h1 className="text-2xl font-bold mt-4 text-gray-800">Sprint Board COMEX 2026</h1>
            <p className="text-gray-500 mt-2">Plan d'action stratégique API & YOU</p>
          </div>
          <div className="space-y-4">
            <input type="password" placeholder="Mot de passe" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full p-4 border rounded-xl text-center text-lg" />
            <button onClick={handleLogin} className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700">Accéder</button>
          </div>
        </div>
      </div>
    );
  }

  // VUE DÉTAIL PROJET
  if (selectedProjet) {
    const axe = getAxeForChantier(selectedProjet.chantierId);
    const chantier = getChantier(selectedProjet.chantierId);
    const meneur = getCollab(selectedProjet.meneur);
    const referentIA = getCollab(selectedProjet.referentComiteIA);
    const referentConf = getCollab(selectedProjet.referentConformite);
    const equipe = (selectedProjet.collaborateurs || []).map(getCollab).filter(Boolean);
    const globalStats = {
      total: projetTaches.length,
      done: projetTaches.filter(t => t.status === 'done').length,
      heuresEstimees: projetTaches.reduce((sum, t) => sum + (t.dureeEstimee || 0), 0),
      heuresReelles: projetTaches.reduce((sum, t) => sum + (t.heuresReelles || 0), 0),
    };
    globalStats.progress = globalStats.total ? Math.round((globalStats.done / globalStats.total) * 100) : 0;

    return (
      <div className="min-h-screen bg-gray-100">
        <div className="bg-gradient-to-r from-purple-700 to-blue-600 text-white p-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedProjet(null)} className="px-3 py-2 bg-white/20 rounded-lg hover:bg-white/30">← Retour</button>
            <div className="flex-1">
              <div className="text-sm opacity-80">{axe?.icon} {axe?.name} • {chantier?.name}</div>
              <h1 className="text-xl font-bold">{selectedProjet.name}</h1>
            </div>
            <div className="text-right">
              <div className="text-sm opacity-80">Semaines {selectedProjet.weekStart} → {selectedProjet.weekEnd}</div>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-32 h-2 bg-white/30 rounded-full overflow-hidden">
                  <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${globalStats.progress}%` }} />
                </div>
                <span className="text-sm">{globalStats.progress}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="space-y-4">
              {selectedProjet.objectif && (
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">🎯 Objectif</h3>
                  <p className="text-gray-600 text-sm">{selectedProjet.objectif}</p>
                </div>
              )}
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold text-gray-800 mb-3">👥 Équipe du projet</h3>
                <div className="space-y-3">
                  {meneur && (
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🏅</span>
                      <span className="text-xs text-gray-500 w-20">Meneur</span>
                      <div className="flex items-center gap-2">
                        {meneur.photo ? <img src={meneur.photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                          : <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm" style={{ backgroundColor: meneur.color }}>{meneur.name.charAt(0)}</div>}
                        <div><div className="font-medium text-sm">{meneur.name}</div><div className="text-xs text-gray-500">{meneur.role}</div></div>
                      </div>
                    </div>
                  )}
                  {referentIA && (
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🎯</span>
                      <span className="text-xs text-gray-500 w-20">Réf. IA</span>
                      <div className="flex items-center gap-2">
                        {referentIA.photo ? <img src={referentIA.photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                          : <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm" style={{ backgroundColor: referentIA.color }}>{referentIA.name.charAt(0)}</div>}
                        <div><div className="font-medium text-sm">{referentIA.name}</div><div className="text-xs text-gray-500">{referentIA.role}</div></div>
                      </div>
                    </div>
                  )}
                  {referentConf && (
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🔒</span>
                      <span className="text-xs text-gray-500 w-20">Réf. Conf.</span>
                      <div className="flex items-center gap-2">
                        {referentConf.photo ? <img src={referentConf.photo} alt="" className="w-8 h-8 rounded-full object-cover" />
                          : <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm" style={{ backgroundColor: referentConf.color }}>{referentConf.name.charAt(0)}</div>}
                        <div><div className="font-medium text-sm">{referentConf.name}</div><div className="text-xs text-gray-500">{referentConf.role}</div></div>
                      </div>
                    </div>
                  )}
                  {equipe.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2"><span className="text-lg">🏃</span><span className="text-xs text-gray-500">Équipe</span></div>
                      <div className="flex flex-wrap gap-2 ml-7">
                        {equipe.map(c => (
                          <div key={c.id} className="flex items-center gap-1" title={`${c.name} - ${c.role}`}>
                            {c.photo ? <img src={c.photo} alt="" className="w-7 h-7 rounded-full object-cover" />
                              : <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: c.color }}>{c.name.charAt(0)}</div>}
                            <span className="text-xs text-gray-600">{c.name.split(' ')[0]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="font-semibold text-gray-800 mb-3">📊 Statistiques</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Tâches</span><span className="font-medium">{globalStats.done}/{globalStats.total}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Heures estimées</span><span className="font-medium">{globalStats.heuresEstimees}h</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Heures réelles</span><span className="font-medium">{globalStats.heuresReelles}h</span></div>
                </div>
              </div>
              
              {/* Section Documents */}
              <div className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">📁 Documents</h3>
                  <button onClick={() => setShowDocumentModal(true)}
                    className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200">
                    + Ajouter
                  </button>
                </div>
                {(!selectedProjet.documents || selectedProjet.documents.length === 0) ? (
                  <p className="text-sm text-gray-400 text-center py-4">Aucun document</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedProjet.documents.map(doc => (
                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg group hover:bg-gray-100">
                        <span className="text-lg">{getDocumentIcon(doc.type, doc.url)}</span>
                        <div className="flex-1 min-w-0">
                          <a href={doc.url} target="_blank" rel="noopener noreferrer" 
                            className="text-sm font-medium text-blue-600 hover:underline truncate block">
                            {doc.name}
                          </a>
                          {doc.size && <span className="text-xs text-gray-400">{formatFileSize(doc.size)}</span>}
                        </div>
                        <button onClick={() => deleteDocument(selectedProjet.id, doc.id)}
                          className="p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="bg-white rounded-lg shadow p-4">
                <button onClick={() => { setEditingProjet(selectedProjet); setShowProjetModal(true); }}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">✏️ Modifier le projet</button>
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">📋 Feuille de route</h2>
                <button onClick={() => { setNewTache({ name: '', projetId: selectedProjet.id, sprint: 'Sprint 1', assigne: '', dureeEstimee: 0, heuresReelles: 0, status: 'todo', commentaire: '' }); setEditingTache(null); setShowTacheModal(true); }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">➕ Nouvelle tâche</button>
              </div>
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-700">
                💡 <strong>Astuce :</strong> Glissez-déposez les tâches entre les sprints pour les réorganiser !
              </div>
              {loadingTaches ? (
                <div className="text-center py-12"><div className="text-4xl mb-4">⏳</div><p className="text-gray-600">Chargement...</p></div>
              ) : (
                <div className="space-y-4">
                  {SPRINTS.map(sprint => {
                    const sprintTaches = getTachesBySprint(sprint);
                    const sprintStats = getSprintStats(sprint);
                    const isDragOver = dragOverSprint === sprint;
                    return (
                      <div key={sprint} className={`bg-white rounded-lg shadow overflow-hidden transition-all ${isDragOver ? 'ring-2 ring-purple-500 ring-offset-2' : ''}`}
                        onDragOver={(e) => handleDragOver(e, sprint)} onDragLeave={() => setDragOverSprint(null)} onDrop={(e) => handleDrop(e, sprint)}>
                        <div className="bg-gray-800 text-white p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold">{sprint}</span>
                            <span className="bg-white/20 px-2 py-0.5 rounded text-sm">{sprintStats.done}/{sprintStats.total}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span>⏱️ {sprintStats.heuresEstimees}h</span>
                            <span>✅ {sprintStats.heuresReelles}h</span>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-white/30 rounded-full overflow-hidden">
                                <div className="h-full bg-green-400 rounded-full" style={{ width: `${sprintStats.progress}%` }} />
                              </div>
                              <span>{sprintStats.progress}%</span>
                            </div>
                          </div>
                        </div>
                        {sprintTaches.length === 0 ? (
                          <div className={`p-8 text-center ${isDragOver ? 'bg-purple-50 text-purple-600' : 'text-gray-400'}`}>
                            {isDragOver ? '🎯 Déposez ici' : 'Aucune tâche'}
                          </div>
                        ) : (
                          <div className="divide-y">
                            {sprintTaches.map(tache => {
                              const assigne = getCollab(tache.assigne);
                              const isDone = tache.status === 'done';
                              return (
                                <div key={tache.id} draggable="true" onDragStart={(e) => handleDragStart(e, tache)} onDragEnd={handleDragEnd}
                                  className={`p-4 hover:bg-gray-50 flex items-center gap-4 cursor-grab active:cursor-grabbing transition-all ${draggedTache?.id === tache.id ? 'opacity-50 bg-purple-50' : ''}`}>
                                  <div className="text-gray-400 cursor-grab">⋮⋮</div>
                                  {/* Photo du collaborateur assigné à gauche */}
                                  <div className="flex-shrink-0" onClick={() => toggleTacheStatus(tache)} title={isDone ? "Marquer à faire" : "Marquer terminé"}>
                                    {assigne ? (
                                      <div className={`relative ${isDone ? 'opacity-60' : ''}`}>
                                        {assigne.photo ? (
                                          <img src={assigne.photo} alt={assigne.name} className={`w-10 h-10 rounded-full object-cover border-2 ${isDone ? 'border-green-500' : 'border-gray-200 hover:border-purple-400'} cursor-pointer transition-all`} />
                                        ) : (
                                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm border-2 ${isDone ? 'border-green-500' : 'border-transparent hover:border-purple-400'} cursor-pointer transition-all`} 
                                            style={{ backgroundColor: assigne.color }}>{assigne.name.charAt(0)}</div>
                                        )}
                                        {isDone && (
                                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className={`w-10 h-10 rounded-full border-2 border-dashed ${isDone ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-purple-400'} flex items-center justify-center cursor-pointer transition-all`}>
                                        {isDone ? <span className="text-green-500 text-lg">✓</span> : <span className="text-gray-400 text-lg">?</span>}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className={`font-medium truncate ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>{tache.name}</div>
                                    {tache.commentaire && <div className="text-sm text-gray-500 truncate">{tache.commentaire}</div>}
                                    {assigne && <div className="text-xs text-gray-400 mt-1">{assigne.name}</div>}
                                  </div>
                                  <div className="text-sm text-gray-500 flex-shrink-0 text-right">
                                    <div>⏱️ {tache.dureeEstimee}h estimé</div>
                                    <div>✅ {tache.heuresReelles}h réel</div>
                                  </div>
                                  <div className="flex gap-1 flex-shrink-0">
                                    <button onClick={() => { setEditingTache(tache); setShowTacheModal(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded" title="Modifier">✏️</button>
                                    <button onClick={() => deleteTache(tache.id)} className="p-2 text-red-500 hover:bg-red-50 rounded" title="Supprimer">🗑️</button>
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
            </div>
          </div>
        </div>

        {/* Modal Projet - accessible depuis la vue détail */}
        {showProjetModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-6 pb-4 border-b">
                <h3 className="text-xl font-bold">{editingProjet ? '✏️ Modifier le projet' : '➕ Nouveau projet'}</h3>
                {editingProjet && (
                  <button onClick={() => { setShowProjetModal(false); setSelectedProjet(editingProjet); }} 
                    className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200">
                    🔍 Détail
                  </button>
                )}
              </div>
              <div className="overflow-y-auto flex-1 p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom du projet *</label>
                  <input type="text" value={editingProjet?.name || newProjet.name}
                    onChange={(e) => editingProjet ? setEditingProjet({ ...editingProjet, name: e.target.value }) : setNewProjet({ ...newProjet, name: e.target.value })}
                    className="w-full p-3 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Objectif</label>
                  <textarea value={editingProjet?.objectif || newProjet.objectif}
                    onChange={(e) => editingProjet ? setEditingProjet({ ...editingProjet, objectif: e.target.value }) : setNewProjet({ ...newProjet, objectif: e.target.value })}
                    rows={2} className="w-full p-3 border rounded-lg" placeholder="Objectif du projet" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chantier *</label>
                  <select value={editingProjet?.chantierId || newProjet.chantierId}
                    onChange={(e) => editingProjet ? setEditingProjet({ ...editingProjet, chantierId: e.target.value }) : setNewProjet({ ...newProjet, chantierId: e.target.value })}
                    className="w-full p-3 border rounded-lg">
                    <option value="">-- Sélectionner --</option>
                    {axes.map(axe => (
                      <optgroup key={axe.id} label={`${axe.icon} ${axe.name}`}>
                        {chantiers.filter(c => c.axeId === axe.id).map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Semaine début</label>
                    <select value={editingProjet?.weekStart || newProjet.weekStart}
                      onChange={(e) => { const val = parseInt(e.target.value); editingProjet ? setEditingProjet({ ...editingProjet, weekStart: val, weekEnd: Math.max(val, editingProjet.weekEnd || val) }) : setNewProjet({ ...newProjet, weekStart: val, weekEnd: Math.max(val, newProjet.weekEnd) }); }}
                      className="w-full p-3 border rounded-lg">
                      {WEEKS.map(w => <option key={w.num} value={w.num}>S{w.num} ({w.dates})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Semaine fin</label>
                    <select value={editingProjet?.weekEnd || newProjet.weekEnd}
                      onChange={(e) => editingProjet ? setEditingProjet({ ...editingProjet, weekEnd: parseInt(e.target.value) }) : setNewProjet({ ...newProjet, weekEnd: parseInt(e.target.value) })}
                      className="w-full p-3 border rounded-lg">
                      {WEEKS.filter(w => w.num >= (editingProjet?.weekStart || newProjet.weekStart)).map(w => <option key={w.num} value={w.num}>S{w.num} ({w.dates})</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                  <div className="flex gap-2">
                    {STATUTS.map(statut => (
                      <button key={statut.id} type="button"
                        onClick={() => editingProjet ? setEditingProjet({ ...editingProjet, status: statut.id }) : setNewProjet({ ...newProjet, status: statut.id })}
                        className={`flex-1 p-3 rounded-lg border-2 ${(editingProjet?.status || newProjet.status) === statut.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
                        <div className="text-xl mb-1">{statut.icon}</div>
                        <div className="text-xs">{statut.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-gray-800 mb-3">👥 Équipe</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">🏅 Meneur</label>
                      <select value={editingProjet?.meneur || newProjet.meneur}
                        onChange={(e) => editingProjet ? setEditingProjet({ ...editingProjet, meneur: e.target.value }) : setNewProjet({ ...newProjet, meneur: e.target.value })}
                        className="w-full p-2 border rounded-lg text-sm">
                        <option value="">—</option>
                        {Object.entries(collabsParService).map(([service, collabs]) => (
                          <optgroup key={service} label={service}>
                            {collabs.map(c => <option key={c.id} value={c.id}>{c.name} - {c.role}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">🎯 Référent Comité IA</label>
                      <select value={editingProjet?.referentComiteIA || newProjet.referentComiteIA}
                        onChange={(e) => editingProjet ? setEditingProjet({ ...editingProjet, referentComiteIA: e.target.value }) : setNewProjet({ ...newProjet, referentComiteIA: e.target.value })}
                        className="w-full p-2 border rounded-lg text-sm">
                        <option value="">—</option>
                        {membresComiteIA.map(c => <option key={c.id} value={c.id}>{c.name} - {c.role}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">🔒 Référent Conformité</label>
                      <select value={editingProjet?.referentConformite || newProjet.referentConformite}
                        onChange={(e) => editingProjet ? setEditingProjet({ ...editingProjet, referentConformite: e.target.value }) : setNewProjet({ ...newProjet, referentConformite: e.target.value })}
                        className="w-full p-2 border rounded-lg text-sm">
                        <option value="">—</option>
                        {membresConformite.map(c => <option key={c.id} value={c.id}>{c.name} - {c.role}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">🏃 Équipe</label>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2 border rounded-lg">
                        {collaborateurs.map(collab => {
                          const isSelected = (editingProjet?.collaborateurs || newProjet.collaborateurs || []).includes(collab.id);
                          return (
                            <button key={collab.id} type="button"
                              onClick={() => {
                                const current = editingProjet?.collaborateurs || newProjet.collaborateurs || [];
                                const updated = isSelected ? current.filter(id => id !== collab.id) : [...current, collab.id];
                                editingProjet ? setEditingProjet({ ...editingProjet, collaborateurs: updated }) : setNewProjet({ ...newProjet, collaborateurs: updated });
                              }}
                              className={`px-2 py-1 rounded text-xs ${isSelected ? 'text-white' : 'bg-gray-100 text-gray-700'}`}
                              style={isSelected ? { backgroundColor: collab.color } : {}}>
                              {collab.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire</label>
                  <textarea value={editingProjet?.commentaire || newProjet.commentaire}
                    onChange={(e) => editingProjet ? setEditingProjet({ ...editingProjet, commentaire: e.target.value }) : setNewProjet({ ...newProjet, commentaire: e.target.value })}
                    rows={2} className="w-full p-3 border rounded-lg" />
                </div>
              </div>
              <div className="flex gap-3 p-6 pt-4 border-t">
                <button onClick={() => { setShowProjetModal(false); setEditingProjet(null); }} className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={() => {
                  const data = editingProjet || newProjet;
                  if (!data.name || !data.chantierId) { alert('Nom et chantier requis'); return; }
                  saveProjet(data);
                }} disabled={isSaving} className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                  {isSaving ? '⏳' : (editingProjet ? 'Modifier' : 'Créer')}
                </button>
              </div>
            </div>
          </div>
        )}

        {showTacheModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
              <h3 className="text-xl font-bold p-6 pb-4 border-b">{editingTache ? '✏️ Modifier la tâche' : '➕ Nouvelle tâche'}</h3>
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input type="text" value={editingTache?.name || newTache.name}
                    onChange={(e) => editingTache ? setEditingTache({ ...editingTache, name: e.target.value }) : setNewTache({ ...newTache, name: e.target.value })}
                    className="w-full p-3 border rounded-lg" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sprint</label>
                    <select value={editingTache?.sprint || newTache.sprint}
                      onChange={(e) => editingTache ? setEditingTache({ ...editingTache, sprint: e.target.value }) : setNewTache({ ...newTache, sprint: e.target.value })}
                      className="w-full p-3 border rounded-lg">
                      {SPRINTS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigné</label>
                    {(() => {
                      // Séparer l'équipe du projet des autres collaborateurs
                      const equipeProjetIds = selectedProjet?.collaborateurs || [];
                      const meneurId = selectedProjet?.meneur;
                      const refIAId = selectedProjet?.referentComiteIA;
                      const refConfId = selectedProjet?.referentConformite;
                      const allEquipeIds = [...new Set([meneurId, refIAId, refConfId, ...equipeProjetIds].filter(Boolean))];
                      
                      const equipeProjet = allEquipeIds.map(id => getCollab(id)).filter(Boolean);
                      const autresCollabs = collaborateurs.filter(c => !allEquipeIds.includes(c.id) && !allEquipeIds.includes(c.recordId));
                      
                      // Grouper les autres par service
                      const autresParService = autresCollabs.reduce((acc, c) => {
                        const service = c.service || 'Autre';
                        if (!acc[service]) acc[service] = [];
                        acc[service].push(c);
                        return acc;
                      }, {});
                      
                      return (
                        <select value={editingTache?.assigne || newTache.assigne}
                          onChange={(e) => editingTache ? setEditingTache({ ...editingTache, assigne: e.target.value }) : setNewTache({ ...newTache, assigne: e.target.value })}
                          className="w-full p-3 border rounded-lg">
                          <option value="">— Non assigné —</option>
                          {equipeProjet.length > 0 && (
                            <optgroup label="👥 Équipe du projet">
                              {equipeProjet.map(c => (
                                <option key={c.recordId || c.id} value={c.recordId || c.id}>
                                  {c.name}{c.id === meneurId || c.recordId === meneurId ? ' 🏅' : ''}{c.id === refIAId || c.recordId === refIAId ? ' 🎯' : ''}{c.id === refConfId || c.recordId === refConfId ? ' 🔒' : ''}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="───────────────"></optgroup>
                          {Object.entries(autresParService).map(([service, collabs]) => (
                            <optgroup key={service} label={`🏢 ${service}`}>
                              {collabs.map(c => <option key={c.recordId || c.id} value={c.recordId || c.id}>{c.name}</option>)}
                            </optgroup>
                          ))}
                        </select>
                      );
                    })()}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Durée estimée (h)</label>
                    <input type="number" min="0" step="0.5" value={editingTache?.dureeEstimee || newTache.dureeEstimee}
                      onChange={(e) => editingTache ? setEditingTache({ ...editingTache, dureeEstimee: parseFloat(e.target.value) || 0 }) : setNewTache({ ...newTache, dureeEstimee: parseFloat(e.target.value) || 0 })}
                      className="w-full p-3 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Heures réelles</label>
                    <input type="number" min="0" step="0.5" value={editingTache?.heuresReelles || newTache.heuresReelles}
                      onChange={(e) => editingTache ? setEditingTache({ ...editingTache, heuresReelles: parseFloat(e.target.value) || 0 }) : setNewTache({ ...newTache, heuresReelles: parseFloat(e.target.value) || 0 })}
                      className="w-full p-3 border rounded-lg" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                  <div className="flex gap-2">
                    {STATUTS.map(statut => (
                      <button key={statut.id} type="button"
                        onClick={() => editingTache ? setEditingTache({ ...editingTache, status: statut.id }) : setNewTache({ ...newTache, status: statut.id })}
                        className={`flex-1 p-3 rounded-lg border-2 ${(editingTache?.status || newTache.status) === statut.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
                        <div className="text-xl mb-1">{statut.icon}</div>
                        <div className="text-xs">{statut.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire</label>
                  <textarea value={editingTache?.commentaire || newTache.commentaire}
                    onChange={(e) => editingTache ? setEditingTache({ ...editingTache, commentaire: e.target.value }) : setNewTache({ ...newTache, commentaire: e.target.value })}
                    rows={2} className="w-full p-3 border rounded-lg" />
                </div>
              </div>
              <div className="flex gap-3 p-6 pt-4 border-t">
                <button onClick={() => { setShowTacheModal(false); setEditingTache(null); }} className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={() => {
                  const data = editingTache || { ...newTache, projetId: selectedProjet.id };
                  if (!data.name) { alert('Nom requis'); return; }
                  saveTache(data);
                }} disabled={isSaving} className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                  {isSaving ? '⏳' : (editingTache ? 'Modifier' : 'Créer')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Ajouter Document */}
        {showDocumentModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
              <h3 className="text-xl font-bold p-6 pb-4 border-b">📁 Ajouter un document</h3>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom du document *</label>
                  <input type="text" value={newDocument.name}
                    onChange={(e) => setNewDocument({ ...newDocument, name: e.target.value })}
                    placeholder="Ex: Cahier des charges v2"
                    className="w-full p-3 border rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Lien vers le document *</label>
                  <input type="url" value={newDocument.url}
                    onChange={(e) => setNewDocument({ ...newDocument, url: e.target.value })}
                    placeholder="https://..."
                    className="w-full p-3 border rounded-lg" />
                  <p className="text-xs text-gray-500 mt-1">OneDrive, Google Drive, Notion, ou tout autre lien</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type de document</label>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { id: 'onedrive', label: '📘 OneDrive', color: 'blue' },
                      { id: 'gdrive', label: '📗 Google Drive', color: 'green' },
                      { id: 'notion', label: '📓 Notion', color: 'gray' },
                      { id: 'other', label: '🔗 Autre', color: 'purple' },
                    ].map(t => (
                      <button key={t.id} type="button"
                        onClick={() => setNewDocument({ ...newDocument, type: t.id })}
                        className={`px-3 py-2 rounded-lg border-2 text-sm ${newDocument.type === t.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 p-6 pt-4 border-t">
                <button onClick={() => { setShowDocumentModal(false); setNewDocument({ name: '', url: '', type: 'onedrive' }); }} 
                  className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50">Annuler</button>
                <button onClick={() => {
                  if (!newDocument.name || !newDocument.url) { alert('Nom et lien requis'); return; }
                  addDocument(selectedProjet.id, newDocument);
                }} disabled={savingDocument} className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                  {savingDocument ? '⏳' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // MAIN APP
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gradient-to-r from-purple-700 to-blue-600 text-white p-4 shadow-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-4xl">🚀</span>
            <div>
              <h1 className="text-2xl font-bold">Sprint Board COMEX 2026</h1>
              <p className="text-purple-200 text-sm">Plan d'action stratégique API & YOU {lastSync && <span>• Sync {formatTime(lastSync)}</span>}</p>
            </div>
          </div>
          <button onClick={fetchAll} disabled={isLoading} className="px-4 py-2 bg-white/20 rounded-lg hover:bg-white/30">{isLoading ? '⏳' : '🔄'} Sync</button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 flex justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="bg-white shadow-sm border-b">
        <div className="flex">
          <button onClick={() => setActiveTab('planning')} className={`px-6 py-3 font-medium ${activeTab === 'planning' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>📊 Planning Visuel</button>
          <button onClick={() => setActiveTab('projets')} className={`px-6 py-3 font-medium ${activeTab === 'projets' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>📋 Gestion des Projets</button>
          <button onClick={() => setActiveTab('equipage')} className={`px-6 py-3 font-medium ${activeTab === 'equipage' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>👥 Équipage</button>
          <div className="ml-auto px-4 py-3 text-sm text-gray-500">{projets.length} projet(s) • {collaborateurs.length} talent(s)</div>
        </div>
      </div>

      <div className="p-4">
        {isLoading && projets.length === 0 ? (
          <div className="text-center py-12"><div className="text-4xl mb-4">⏳</div><p className="text-gray-600">Chargement...</p></div>
        ) : (
          <>
            {activeTab === 'planning' && (
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
                  <div className="flex items-center gap-4">
                    <span className="font-medium text-gray-700">Trimestre :</span>
                    {[1, 2, 3, 4].map(t => (
                      <button key={t} onClick={() => setTrimestre(t)}
                        className={`px-4 py-2 rounded-lg font-medium ${trimestre === t ? 'bg-purple-600 text-white' : 'bg-white border hover:bg-gray-100'}`}>T{t}</button>
                    ))}
                  </div>
                  <select value={filtreAxe} onChange={(e) => { setFiltreAxe(e.target.value); setFiltreChantier(''); }} className="p-2 border rounded-lg">
                    <option value="">Tous les axes</option>
                    {axes.map(axe => <option key={axe.id} value={axe.id}>{axe.icon} {axe.name}</option>)}
                  </select>
                </div>
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
                          <tr style={{ backgroundColor: axe.color }}>
                            <td className="p-2 font-bold text-white sticky left-0" style={{ backgroundColor: axe.color }} colSpan={currentWeeks.length + 1}>{axe.icon} {axe.name}</td>
                          </tr>
                          {chantiers.filter(c => c.axeId === axe.id).map(chantier => (
                            <tr key={chantier.id} className="border-b hover:bg-gray-50">
                              <td className="p-2 text-sm font-medium sticky left-0 bg-white border-r">{chantier.name}</td>
                              {currentWeeks.map(week => {
                                const weekProjets = getProjetsForWeek(week.num, chantier.id);
                                return (
                                  <td key={week.num} className="p-0 border-l cursor-pointer hover:bg-purple-50"
                                    onClick={() => { setNewProjet({ ...newProjet, chantierId: chantier.id, weekStart: week.num, weekEnd: week.num }); setEditingProjet(null); setShowProjetModal(true); }}>
                                    {weekProjets.map(projet => {
                                      const statut = STATUTS.find(s => s.id === projet.status);
                                      return (
                                        <div key={projet.id} className="text-[9px] p-1 m-0.5 rounded text-white truncate cursor-pointer hover:opacity-80"
                                          style={{ backgroundColor: statut?.color || '#666' }}
                                          onClick={(e) => { e.stopPropagation(); setEditingProjet(projet); setShowProjetModal(true); }}
                                          title={projet.name}>📌 {projet.name}</div>
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
                <div className="p-4 bg-gray-50 border-t flex items-center gap-6 flex-wrap">
                  <span className="font-medium text-gray-700">Légende :</span>
                  {STATUTS.map(statut => (
                    <div key={statut.id} className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: statut.color }}></div>
                      <span className="text-sm">{statut.icon} {statut.name}</span>
                    </div>
                  ))}
                  <span className="text-sm text-gray-500">📌 Cliquez sur un projet = configurer | Case vide = nouveau projet</span>
                </div>
              </div>
            )}

            {activeTab === 'projets' && (
              <div className="space-y-4">
                <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <select value={filtreAxe} onChange={(e) => { setFiltreAxe(e.target.value); setFiltreChantier(''); }} className="p-2 border rounded-lg">
                      <option value="">Tous les axes</option>
                      {axes.map(axe => <option key={axe.id} value={axe.id}>{axe.icon} {axe.name}</option>)}
                    </select>
                    <select value={filtreChantier} onChange={(e) => setFiltreChantier(e.target.value)} className="p-2 border rounded-lg">
                      <option value="">Tous les chantiers</option>
                      {chantiersFiltres.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                    </select>
                    <select value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)} className="p-2 border rounded-lg">
                      <option value="">Tous statuts</option>
                      {STATUTS.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                    </select>
                  </div>
                  <button onClick={() => { setNewProjet({ name: '', chantierId: chantiers[0]?.id || '', weekStart: 1, weekEnd: 1, collaborateurs: [], status: 'todo', commentaire: '', avancement: 0, objectif: '', referentComiteIA: '', referentConformite: '', meneur: '' }); setEditingProjet(null); setShowProjetModal(true); }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">➕ Nouveau projet</button>
                </div>
                {(filtreChantier ? [chantiers.find(c => c.id === filtreChantier)] : chantiersFiltres).filter(Boolean).map(chantier => {
                  const axe = getAxeForChantier(chantier.id);
                  const chantierProjets = projetsFiltres.filter(p => p.chantierId === chantier.id);
                  if (chantierProjets.length === 0 && filtreChantier !== chantier.id) return null;
                  return (
                    <div key={chantier.id} className="bg-white rounded-lg shadow overflow-hidden">
                      <div className="p-3 text-white font-bold flex items-center justify-between" style={{ backgroundColor: axe?.color || '#666' }}>
                        <span>{axe?.icon} {chantier.name}</span>
                        <span className="text-sm font-normal opacity-80">{chantierProjets.length} projet(s)</span>
                      </div>
                      {chantierProjets.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">Aucun projet</div>
                      ) : (
                        <div className="divide-y">
                          {chantierProjets.map(projet => {
                            const statut = STATUTS.find(s => s.id === projet.status);
                            return (
                              <div key={projet.id} className="p-4 hover:bg-gray-50 flex items-center gap-4">
                                <div className="w-3 h-12 rounded" style={{ backgroundColor: statut?.color }} />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-800 truncate">{projet.name}</div>
                                  <div className="text-sm text-gray-500 flex items-center gap-4 mt-1 flex-wrap">
                                    <span>📅 S{projet.weekStart}{projet.weekEnd !== projet.weekStart ? ` → S${projet.weekEnd}` : ''}</span>
                                    <span className="px-2 py-0.5 rounded text-white text-xs" style={{ backgroundColor: statut?.color }}>{statut?.icon} {statut?.name}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  {projet.collaborateurs?.slice(0, 3).map(collabId => {
                                    const collab = getCollab(collabId);
                                    if (!collab) return null;
                                    return collab.photo ? 
                                      <img key={collabId} src={collab.photo} alt="" className="w-8 h-8 rounded-full object-cover" title={collab.name} />
                                      : <div key={collabId} className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm" style={{ backgroundColor: collab.color }} title={collab.name}>{collab.name.charAt(0)}</div>;
                                  })}
                                  {projet.collaborateurs?.length > 3 && <span className="text-xs text-gray-500">+{projet.collaborateurs.length - 3}</span>}
                                </div>
                                <div className="flex gap-1">
                                  <button onClick={() => setSelectedProjet(projet)} className="p-2 text-purple-500 hover:bg-purple-50 rounded" title="Détail & tâches">🔍</button>
                                  <button onClick={() => { setEditingProjet(projet); setShowProjetModal(true); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded" title="Configurer">✏️</button>
                                  <button onClick={() => deleteProjet(projet.id)} className="p-2 text-red-500 hover:bg-red-50 rounded" title="Supprimer">🗑️</button>
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

            {activeTab === 'equipage' && (
              <div className="space-y-6">
                {/* Filtres Équipage */}
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex flex-wrap gap-4 items-center">
                    {/* Recherche */}
                    <div className="flex-1 min-w-[200px]">
                      <input
                        type="text"
                        placeholder="🔍 Rechercher un collaborateur..."
                        value={equipageSearch}
                        onChange={(e) => setEquipageSearch(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                      />
                    </div>
                    
                    {/* Filtre Pôle/Service */}
                    <select
                      value={equipagePoleFilter}
                      onChange={(e) => setEquipagePoleFilter(e.target.value)}
                      className="px-4 py-2 border rounded-lg focus:outline-none focus:border-purple-500"
                    >
                      <option value="">Tous les pôles</option>
                      {[...new Set(collaborateurs.map(c => c.service).filter(Boolean))].sort().map(service => (
                        <option key={service} value={service}>{POLES_DISPLAY_NAME[service] || service}</option>
                      ))}
                    </select>
                    
                    {/* Filtres rapides */}
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { id: '', label: 'Tous', icon: '👥' },
                        { id: 'comiteStrategiqueIA', label: 'Comité Stratégique IA', icon: '🤖' },
                        { id: 'commissionConformite', label: 'Commission Conformité IA', icon: '🔒' },
                        { id: 'directeur', label: 'Directeurs', icon: '⭐' },
                      ].map(f => (
                        <button
                          key={f.id}
                          onClick={() => setEquipageRoleFilter(f.id)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                            equipageRoleFilter === f.id 
                              ? 'bg-purple-600 text-white' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {f.icon} {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Grille par pôle */}
                {(() => {
                  // Filtrer les collaborateurs
                  const filteredCollabs = collaborateurs.filter(c => {
                    const matchSearch = c.name?.toLowerCase().includes(equipageSearch.toLowerCase()) ||
                                        c.role?.toLowerCase().includes(equipageSearch.toLowerCase());
                    const matchPole = !equipagePoleFilter || c.service === equipagePoleFilter;
                    const matchRole = !equipageRoleFilter || 
                      (equipageRoleFilter === 'comiteStrategiqueIA' && c.estComiteStrategiqueIA) ||
                      (equipageRoleFilter === 'commissionConformite' && c.estCommissionConformite) ||
                      (equipageRoleFilter === 'directeur' && c.estDirecteur);
                    return matchSearch && matchPole && matchRole;
                  });
                  
                  // Grouper par service/pôle
                  const collabsByPole = {};
                  const services = [...new Set(filteredCollabs.map(c => c.service || 'Autre'))];
                  
                  // Trier les services selon POLES_ORDER
                  services.sort((a, b) => {
                    const indexA = POLES_ORDER.indexOf(a);
                    const indexB = POLES_ORDER.indexOf(b);
                    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
                    if (indexA === -1) return 1;
                    if (indexB === -1) return -1;
                    return indexA - indexB;
                  });
                  
                  services.forEach(service => {
                    collabsByPole[service] = filteredCollabs.filter(c => (c.service || 'Autre') === service);
                  });
                  
                  if (filteredCollabs.length === 0) {
                    return (
                      <div className="text-center py-12 bg-white rounded-lg shadow">
                        <span className="text-4xl">🔍</span>
                        <p className="text-gray-500 mt-4">Aucun collaborateur trouvé</p>
                      </div>
                    );
                  }
                  
                  return Object.entries(collabsByPole).map(([pole, collabs]) => {
                    const poleInfo = POLES[pole] || POLES['Autre'];
                    const displayName = POLES_DISPLAY_NAME[pole] || pole; // Utiliser le nom d'affichage si défini
                    return (
                      <div key={pole} className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="p-4 border-b flex items-center gap-3" style={{ backgroundColor: poleInfo.bgLight }}>
                          <h2 className="text-lg font-bold" style={{ color: poleInfo.color }}>{displayName}</h2>
                          <span className="px-2 py-1 bg-white/50 rounded-full text-sm" style={{ color: poleInfo.color }}>{collabs.length}</span>
                        </div>
                        
                        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                          {collabs.map(collab => {
                            const isSelected = selectedCollaborateur?.id === collab.id;
                            return (
                              <div 
                                key={collab.id}
                                onClick={() => setSelectedCollaborateur(collab)}
                                className={`p-3 rounded-xl cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 border-2 ${
                                  isSelected ? 'border-purple-500 bg-purple-50' : 'border-transparent bg-gray-50 hover:bg-white'
                                }`}
                              >
                                <div className="flex flex-col items-center text-center">
                                  {collab.photo ? (
                                    <img src={collab.photo} alt={collab.name} className="w-14 h-14 rounded-full object-cover shadow-md" />
                                  ) : (
                                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold shadow-md text-lg"
                                      style={{ backgroundColor: collab.color || poleInfo.color }}>
                                      {collab.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </div>
                                  )}
                                  <h3 className="font-semibold text-gray-800 mt-2 text-sm leading-tight">{collab.name}</h3>
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{collab.role}</p>
                                  
                                  {/* Badges */}
                                  <div className="flex gap-1 mt-2 flex-wrap justify-center">
                                    {collab.estComiteStrategiqueIA && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500 text-white font-semibold">Comité IA</span>
                                    )}
                                    {collab.estCommissionConformite && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500 text-white font-semibold">Conformité</span>
                                    )}
                                    {collab.estDirecteur && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-semibold">Directeur</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </>
        )}
      </div>

      {/* Panneau détail collaborateur */}
      {selectedCollaborateur && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSelectedCollaborateur(null)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto animate-slide-in">
            {(() => {
              const collab = selectedCollaborateur;
              const poleInfo = POLES[collab.service] || POLES['Autre'];
              const directeur = collaborateurs.find(c => c.name === collab.directeur || c.id === collab.directeurId);
              const equipe = collaborateurs.filter(c => c.directeur === collab.name || c.directeurId === collab.id);
              const collabProjets = projets.filter(p => 
                p.collaborateurs?.includes(collab.id) || 
                p.collaborateurs?.includes(collab.recordId) ||
                p.meneur === collab.id ||
                p.referentComiteIA === collab.id ||
                p.referentConformite === collab.id
              );
              
              return (
                <>
                  {/* Header */}
                  <div className="p-6 text-white" style={{ backgroundColor: poleInfo.color }}>
                    <button 
                      onClick={() => setSelectedCollaborateur(null)}
                      className="absolute top-4 right-4 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 text-white"
                    >
                      ✕
                    </button>
                    
                    <div className="flex items-center gap-4 mt-4">
                      {collab.photo ? (
                        <img src={collab.photo} alt={collab.name} className="w-24 h-24 rounded-full object-cover border-4 border-white/30 shadow-lg" />
                      ) : (
                        <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold border-4 border-white/30 shadow-lg"
                          style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                          {collab.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <h2 className="text-2xl font-bold">{collab.name}</h2>
                        <p className="text-white/80">{collab.role}</p>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {collab.estComiteStrategiqueIA && (
                            <span className="text-xs px-2 py-1 rounded bg-white/20 font-semibold">🤖 Comité Stratégique IA</span>
                          )}
                          {collab.estCommissionConformite && (
                            <span className="text-xs px-2 py-1 rounded bg-white/20 font-semibold">🔒 Commission Conformité IA</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6 space-y-6">
                    {/* Pôle */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Pôle</h3>
                      <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: poleInfo.bgLight }}>
                        <span className="font-medium" style={{ color: poleInfo.color }}>{POLES_DISPLAY_NAME[collab.service] || collab.service || 'Non défini'}</span>
                      </div>
                    </div>
                    
                    {/* Directeur */}
                    {directeur && (
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">👔 Rattaché à</h3>
                        <div 
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                          onClick={() => setSelectedCollaborateur(directeur)}
                        >
                          {directeur.photo ? (
                            <img src={directeur.photo} alt={directeur.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm"
                              style={{ backgroundColor: POLES[directeur.service]?.color || '#6B7280' }}>
                              {directeur.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-800">{directeur.name}</p>
                            <p className="text-xs text-gray-500">{directeur.role}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Équipe */}
                    {equipe.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">👥 Son équipe ({equipe.length})</h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {equipe.slice(0, 10).map(membre => (
                            <div 
                              key={membre.id} 
                              className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                              onClick={() => setSelectedCollaborateur(membre)}
                            >
                              {membre.photo ? (
                                <img src={membre.photo} alt={membre.name} className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs"
                                  style={{ backgroundColor: POLES[membre.service]?.color || '#6B7280' }}>
                                  {membre.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-gray-800 text-sm">{membre.name}</p>
                                <p className="text-xs text-gray-500">{membre.role}</p>
                              </div>
                            </div>
                          ))}
                          {equipe.length > 10 && (
                            <p className="text-sm text-gray-500 text-center py-2">+ {equipe.length - 10} autres</p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Projets */}
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">📋 Projets assignés</h3>
                      {collabProjets.length === 0 ? (
                        <p className="text-gray-400 text-sm p-3 bg-gray-50 rounded-lg">Aucun projet en cours</p>
                      ) : (
                        <div className="space-y-2">
                          {collabProjets.map(projet => {
                            const chantier = chantiers.find(c => c.id === projet.chantierId);
                            const axe = axes.find(a => a.id === chantier?.axeId);
                            return (
                              <div 
                                key={projet.id} 
                                className="p-3 bg-purple-50 rounded-lg border border-purple-100 cursor-pointer hover:bg-purple-100"
                                onClick={() => { setSelectedCollaborateur(null); setSelectedProjet(projet); }}
                              >
                                <p className="font-medium text-purple-800">{projet.name}</p>
                                <p className="text-xs text-purple-600 mt-1">{axe?.icon} {chantier?.name}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs text-gray-500">S{projet.weekStart} → S{projet.weekEnd}</span>
                                  {projet.meneur === collab.id && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">🏅 Meneur</span>}
                                  {projet.referentComiteIA === collab.id && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">🎯 Réf. IA</span>}
                                  {projet.referentConformite === collab.id && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">🔒 Réf. Conf.</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    
                    {/* Contact */}
                    {collab.email && (
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">📧 Contact</h3>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <a href={`mailto:${collab.email}`} className="text-sm text-blue-600 hover:underline">{collab.email}</a>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </>
      )}

      {showProjetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 pb-4 border-b">
              <h3 className="text-xl font-bold">{editingProjet ? '✏️ Modifier le projet' : '➕ Nouveau projet'}</h3>
              {editingProjet && (
                <button onClick={() => { setShowProjetModal(false); setSelectedProjet(editingProjet); }} 
                  className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200">
                  🔍 Détail
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du projet *</label>
                <input type="text" value={editingProjet?.name || newProjet.name}
                  onChange={(e) => editingProjet ? setEditingProjet({ ...editingProjet, name: e.target.value }) : setNewProjet({ ...newProjet, name: e.target.value })}
                  className="w-full p-3 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Objectif</label>
                <textarea value={editingProjet?.objectif || newProjet.objectif}
                  onChange={(e) => editingProjet ? setEditingProjet({ ...editingProjet, objectif: e.target.value }) : setNewProjet({ ...newProjet, objectif: e.target.value })}
                  rows={2} className="w-full p-3 border rounded-lg" placeholder="Objectif du projet" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chantier *</label>
                <select value={editingProjet?.chantierId || newProjet.chantierId}
                  onChange={(e) => editingProjet ? setEditingProjet({ ...editingProjet, chantierId: e.target.value }) : setNewProjet({ ...newProjet, chantierId: e.target.value })}
                  className="w-full p-3 border rounded-lg">
                  <option value="">-- Sélectionner --</option>
                  {axes.map(axe => (
                    <optgroup key={axe.id} label={`${axe.icon} ${axe.name}`}>
                      {chantiers.filter(c => c.axeId === axe.id).map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semaine début</label>
                  <select value={editingProjet?.weekStart || newProjet.weekStart}
                    onChange={(e) => { const val = parseInt(e.target.value); editingProjet ? setEditingProjet({ ...editingProjet, weekStart: val, weekEnd: Math.max(val, editingProjet.weekEnd || val) }) : setNewProjet({ ...newProjet, weekStart: val, weekEnd: Math.max(val, newProjet.weekEnd) }); }}
                    className="w-full p-3 border rounded-lg">
                    {WEEKS.map(w => <option key={w.num} value={w.num}>S{w.num} ({w.dates})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semaine fin</label>
                  <select value={editingProjet?.weekEnd || newProjet.weekEnd}
                    onChange={(e) => editingProjet ? setEditingProjet({ ...editingProjet, weekEnd: parseInt(e.target.value) }) : setNewProjet({ ...newProjet, weekEnd: parseInt(e.target.value) })}
                    className="w-full p-3 border rounded-lg">
                    {WEEKS.filter(w => w.num >= (editingProjet?.weekStart || newProjet.weekStart)).map(w => <option key={w.num} value={w.num}>S{w.num} ({w.dates})</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                <div className="flex gap-2">
                  {STATUTS.map(statut => (
                    <button key={statut.id} type="button"
                      onClick={() => editingProjet ? setEditingProjet({ ...editingProjet, status: statut.id }) : setNewProjet({ ...newProjet, status: statut.id })}
                      className={`flex-1 p-3 rounded-lg border-2 ${(editingProjet?.status || newProjet.status) === statut.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
                      <div className="text-xl mb-1">{statut.icon}</div>
                      <div className="text-xs">{statut.name}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-800 mb-3">👥 Équipe</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">🏅 Meneur</label>
                    <select value={editingProjet?.meneur || newProjet.meneur}
                      onChange={(e) => editingProjet ? setEditingProjet({ ...editingProjet, meneur: e.target.value }) : setNewProjet({ ...newProjet, meneur: e.target.value })}
                      className="w-full p-2 border rounded-lg text-sm">
                      <option value="">—</option>
                      {Object.entries(collabsParService).map(([service, collabs]) => (
                        <optgroup key={service} label={service}>
                          {collabs.map(c => <option key={c.id} value={c.id}>{c.name} - {c.role}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">🎯 Référent Comité IA</label>
                    <select value={editingProjet?.referentComiteIA || newProjet.referentComiteIA}
                      onChange={(e) => editingProjet ? setEditingProjet({ ...editingProjet, referentComiteIA: e.target.value }) : setNewProjet({ ...newProjet, referentComiteIA: e.target.value })}
                      className="w-full p-2 border rounded-lg text-sm">
                      <option value="">—</option>
                      {membresComiteIA.map(c => <option key={c.id} value={c.id}>{c.name} - {c.role}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">🔒 Référent Conformité</label>
                    <select value={editingProjet?.referentConformite || newProjet.referentConformite}
                      onChange={(e) => editingProjet ? setEditingProjet({ ...editingProjet, referentConformite: e.target.value }) : setNewProjet({ ...newProjet, referentConformite: e.target.value })}
                      className="w-full p-2 border rounded-lg text-sm">
                      <option value="">—</option>
                      {membresConformite.map(c => <option key={c.id} value={c.id}>{c.name} - {c.role}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">🏃 Équipe</label>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2 border rounded-lg">
                      {collaborateurs.map(collab => {
                        const isSelected = (editingProjet?.collaborateurs || newProjet.collaborateurs || []).includes(collab.id);
                        return (
                          <button key={collab.id} type="button"
                            onClick={() => {
                              const current = editingProjet?.collaborateurs || newProjet.collaborateurs || [];
                              const updated = isSelected ? current.filter(id => id !== collab.id) : [...current, collab.id];
                              editingProjet ? setEditingProjet({ ...editingProjet, collaborateurs: updated }) : setNewProjet({ ...newProjet, collaborateurs: updated });
                            }}
                            className={`px-2 py-1 rounded text-xs ${isSelected ? 'text-white' : 'bg-gray-100 text-gray-700'}`}
                            style={isSelected ? { backgroundColor: collab.color } : {}}>
                            {collab.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire</label>
                <textarea value={editingProjet?.commentaire || newProjet.commentaire}
                  onChange={(e) => editingProjet ? setEditingProjet({ ...editingProjet, commentaire: e.target.value }) : setNewProjet({ ...newProjet, commentaire: e.target.value })}
                  rows={2} className="w-full p-3 border rounded-lg" />
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-4 border-t">
              <button onClick={() => { setShowProjetModal(false); setEditingProjet(null); }} className="flex-1 px-4 py-3 border rounded-lg hover:bg-gray-50">Annuler</button>
              <button onClick={() => {
                const data = editingProjet || newProjet;
                if (!data.name || !data.chantierId) { alert('Nom et chantier requis'); return; }
                saveProjet(data);
              }} disabled={isSaving} className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                {isSaving ? '⏳' : (editingProjet ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
