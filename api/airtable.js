// API Route Vercel pour Airtable - Sprint Board avec Tâches
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

// Tables - IDs Airtable
const TABLES = {
  items: 'tblcIBoB5nl6PDCfn',
  sprints: 'tblSFNt5dWgiU89g2',
  axes: 'tblBwHP0Ft9pkntyy',
  chantiers: 'tblIkKyzPB7u8NWzI',
  collaborateurs: 'tblVtL5KEJQmxBra3',
  taches: 'tblUyYKjBoTIz5YuK',
  participants: 'tblZvRwtMw0jziUOP',
};

const getAirtableUrl = (table) => `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${table}`;

// Récupérer tous les enregistrements avec pagination
const fetchAllRecords = async (tableName, headers) => {
  let allRecords = [];
  let offset = null;

  do {
    const url = offset 
      ? `${getAirtableUrl(tableName)}?offset=${offset}` 
      : getAirtableUrl(tableName);
    
    const response = await fetch(url, { headers });
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    allRecords = [...allRecords, ...data.records];
    offset = data.offset;
  } while (offset);

  return allRecords;
};

// Mapping des statuts code <-> Airtable
const STATUS_TO_AIRTABLE = {
  'todo': 'À faire',
  'in_progress': 'En cours',
  'done': 'Terminé'
};

const STATUS_FROM_AIRTABLE = {
  'À faire': 'todo',
  'En cours': 'in_progress',
  'Terminé': 'done'
};

const toAirtableStatus = (status) => STATUS_TO_AIRTABLE[status] || status || 'À faire';
const fromAirtableStatus = (status) => STATUS_FROM_AIRTABLE[status] || status || 'todo';

// Helper pour extraire un ID string depuis un Linked Record (peut être string ou tableau)
const extractId = (val) => {
  if (!val) return '';
  if (Array.isArray(val)) return val[0] || '';
  return val;
};

// Helper pour vérifier si une valeur est un recordId Airtable
const isRecordId = (val) => {
  const id = extractId(val);
  return typeof id === 'string' && id.startsWith('rec');
};

// Helper pour parser les collaborateurs
const parseCollaborateurs = (val) => {
  if (!val) return [];
  try {
    const parsed = typeof val === 'string' ? JSON.parse(val) : val;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const allIds = [];
      Object.values(parsed).forEach(v => {
        if (Array.isArray(v)) allIds.push(...v);
        else if (typeof v === 'string') allIds.push(v);
      });
      return [...new Set(allIds)];
    }
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

// Helper pour convertir les checkboxes Airtable
const toBool = (val) => val === true || val === 'checked' || val === 'TRUE';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!AIRTABLE_TOKEN || !AIRTABLE_BASE_ID) {
    return res.status(500).json({ error: 'Configuration manquante' });
  }

  const headers = {
    'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
    'Content-Type': 'application/json',
  };

  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const tableType = searchParams.get('table') || 'items';
  const projetId = searchParams.get('projetId');

  try {
    // ========== ITEMS (Projets) ==========
    if (tableType === 'items') {
      if (req.method === 'GET') {
        const records = await fetchAllRecords(TABLES.items, headers);
        
        const items = records.map(record => {
          // Parser les documents (liens externes stockés en JSON)
          let documents = [];
          try {
            documents = record.fields.Documents ? JSON.parse(record.fields.Documents) : [];
          } catch { documents = []; }
          
          // Récupérer les fichiers attachés Airtable
          const fichiers = (record.fields.Fichiers || []).map(f => ({
            id: f.id,
            name: f.filename,
            url: f.url,
            size: f.size,
            type: f.type,
            isFile: true
          }));
          
          return {
            id: record.id,
            name: record.fields.Name || '',
            chantierId: record.fields.ChantierId || '',
            weekStart: record.fields.WeekStart || 1,
            weekEnd: record.fields.WeekEnd || record.fields.WeekStart || 1,
            collaborateurs: parseCollaborateurs(record.fields.CollaborateursParRole),
            status: record.fields.Status || 'todo',
            commentaire: record.fields.Commentaire || '',
            avancement: record.fields.Avancement || 0,
            objectif: record.fields.Objectif || '',
            referentComiteIA: record.fields.ReferentComiteIA || '',
            referentConformite: record.fields.ReferentConformite || '',
            meneur: record.fields.Meneur || '',
            sprintsNoms: record.fields.SprintsNoms || '',
            dateComiteIA: record.fields.DateComiteIA || null,
            documents: [...documents, ...fichiers],
          };
        });

        return res.status(200).json({ items });
      }

      if (req.method === 'POST') {
        const { name, chantierId, weekStart, weekEnd, collaborateurs, status, commentaire, avancement, objectif, referentComiteIA, referentConformite, meneur } = req.body;
        
        const response = await fetch(getAirtableUrl(TABLES.items), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            records: [{
              fields: {
                Name: name,
                ChantierId: chantierId,
                WeekStart: weekStart || 1,
                WeekEnd: weekEnd || weekStart || 1,
                CollaborateursParRole: JSON.stringify(collaborateurs || []),
                Status: status || 'todo',
                Commentaire: commentaire || '',
                Avancement: avancement || 0,
                Objectif: objectif || '',
                ReferentComiteIA: referentComiteIA || '',
                ReferentConformite: referentConformite || '',
                Meneur: meneur || '',
              }
            }]
          }),
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const record = data.records[0];
        return res.status(201).json({
          item: {
            id: record.id,
            name: record.fields.Name,
            chantierId: record.fields.ChantierId,
            weekStart: record.fields.WeekStart,
            weekEnd: record.fields.WeekEnd,
            collaborateurs: parseCollaborateurs(record.fields.CollaborateursParRole),
            status: record.fields.Status,
            commentaire: record.fields.Commentaire || '',
            avancement: record.fields.Avancement || 0,
            objectif: record.fields.Objectif || '',
            referentComiteIA: record.fields.ReferentComiteIA || '',
            referentConformite: record.fields.ReferentConformite || '',
            meneur: record.fields.Meneur || '',
          }
        });
      }

      if (req.method === 'PUT' || req.method === 'PATCH') {
        const { id, name, chantierId, weekStart, weekEnd, collaborateurs, status, commentaire, avancement, objectif, referentComiteIA, referentConformite, meneur, sprintsNoms, dateComiteIA } = req.body;
        if (!id) return res.status(400).json({ error: 'ID requis' });

        // Construire les champs à mettre à jour (seulement ceux fournis)
        const fieldsToUpdate = {};
        if (name !== undefined) fieldsToUpdate.Name = name;
        if (chantierId !== undefined) fieldsToUpdate.ChantierId = chantierId;
        if (weekStart !== undefined) fieldsToUpdate.WeekStart = weekStart || 1;
        if (weekEnd !== undefined) fieldsToUpdate.WeekEnd = weekEnd || weekStart || 1;
        if (collaborateurs !== undefined) fieldsToUpdate.CollaborateursParRole = JSON.stringify(collaborateurs || []);
        if (status !== undefined) fieldsToUpdate.Status = status || 'todo';
        if (commentaire !== undefined) fieldsToUpdate.Commentaire = commentaire || '';
        if (avancement !== undefined) fieldsToUpdate.Avancement = avancement || 0;
        if (objectif !== undefined) fieldsToUpdate.Objectif = objectif || '';
        if (referentComiteIA !== undefined) fieldsToUpdate.ReferentComiteIA = referentComiteIA || '';
        if (referentConformite !== undefined) fieldsToUpdate.ReferentConformite = referentConformite || '';
        if (meneur !== undefined) fieldsToUpdate.Meneur = meneur || '';
        if (sprintsNoms !== undefined) fieldsToUpdate.SprintsNoms = sprintsNoms || '';
        if (dateComiteIA !== undefined) fieldsToUpdate.DateComiteIA = dateComiteIA || null;

        const response = await fetch(getAirtableUrl(TABLES.items), {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            records: [{
              id,
              fields: fieldsToUpdate
            }]
          }),
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const record = data.records[0];
        return res.status(200).json({
          item: {
            id: record.id,
            name: record.fields.Name,
            chantierId: record.fields.ChantierId,
            weekStart: record.fields.WeekStart,
            weekEnd: record.fields.WeekEnd,
            collaborateurs: parseCollaborateurs(record.fields.CollaborateursParRole),
            status: record.fields.Status,
            commentaire: record.fields.Commentaire || '',
            avancement: record.fields.Avancement || 0,
            objectif: record.fields.Objectif || '',
            referentComiteIA: record.fields.ReferentComiteIA || '',
            referentConformite: record.fields.ReferentConformite || '',
            meneur: record.fields.Meneur || '',
            sprintsNoms: record.fields.SprintsNoms || '',
          }
        });
      }

      if (req.method === 'DELETE') {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'ID requis' });

        await fetch(`${getAirtableUrl(TABLES.items)}?records[]=${id}`, {
          method: 'DELETE',
          headers,
        });

        return res.status(200).json({ success: true });
      }
    }

    // ========== DOCUMENTS (liens pour un projet) ==========
    if (tableType === 'documents') {
      // Ajouter un lien document à un projet
      if (req.method === 'POST') {
        const { projetId, name, url, type } = req.body;
        if (!projetId || !name || !url) {
          return res.status(400).json({ error: 'projetId, name et url requis' });
        }

        // Récupérer le projet actuel
        const getResponse = await fetch(`${getAirtableUrl(TABLES.items)}/${projetId}`, { headers });
        const getProjet = await getResponse.json();
        if (getProjet.error) throw new Error(getProjet.error.message);

        // Parser les documents existants
        let documents = [];
        try {
          documents = getProjet.fields.Documents ? JSON.parse(getProjet.fields.Documents) : [];
        } catch { documents = []; }

        // Ajouter le nouveau document
        const newDoc = {
          id: `doc_${Date.now()}`,
          name,
          url,
          type: type || 'link',
          addedAt: new Date().toISOString(),
          isFile: false
        };
        documents.push(newDoc);

        // Mettre à jour le projet
        const updateResponse = await fetch(getAirtableUrl(TABLES.items), {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            records: [{
              id: projetId,
              fields: { Documents: JSON.stringify(documents) }
            }]
          }),
        });

        const updateData = await updateResponse.json();
        if (updateData.error) throw new Error(updateData.error.message);

        return res.status(201).json({ document: newDoc, documents });
      }

      // Supprimer un lien document
      if (req.method === 'DELETE') {
        const { projetId, documentId } = req.body;
        if (!projetId || !documentId) {
          return res.status(400).json({ error: 'projetId et documentId requis' });
        }

        // Récupérer le projet actuel
        const getResponse = await fetch(`${getAirtableUrl(TABLES.items)}/${projetId}`, { headers });
        const getProjet = await getResponse.json();
        if (getProjet.error) throw new Error(getProjet.error.message);

        // Parser et filtrer les documents
        let documents = [];
        try {
          documents = getProjet.fields.Documents ? JSON.parse(getProjet.fields.Documents) : [];
        } catch { documents = []; }

        documents = documents.filter(d => d.id !== documentId);

        // Mettre à jour le projet
        const updateResponse = await fetch(getAirtableUrl(TABLES.items), {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            records: [{
              id: projetId,
              fields: { Documents: JSON.stringify(documents) }
            }]
          }),
        });

        const updateData = await updateResponse.json();
        if (updateData.error) throw new Error(updateData.error.message);

        return res.status(200).json({ success: true, documents });
      }
    }

    // ========== TACHES ==========
    if (tableType === 'taches') {
      if (req.method === 'GET') {
        const records = await fetchAllRecords(TABLES.taches, headers);
        
        let taches = records.map(record => {
          // Gérer Projet qui peut être un Linked Record (tableau) ou texte
          let projetId = record.fields.Projet || record.fields['Projet'] || '';
          if (Array.isArray(projetId) && projetId.length > 0) {
            projetId = projetId[0]; // Prendre le premier si c'est un tableau
          }
          
          // Gérer Capitaine qui peut être un Linked Record (tableau) ou texte
          let capitaine = record.fields['Capitaine'] || record.fields.Capitaine || '';
          if (Array.isArray(capitaine) && capitaine.length > 0) {
            capitaine = capitaine[0];
          }
          
          return {
            id: record.id,
            name: record.fields['Nom de la tâche'] || record.fields.Name || '',
            projetId: projetId,
            sprint: record.fields['Sprint/Phase'] || record.fields.Sprint || 'Backlog',
            capitaine: capitaine,
            dureeEstimee: record.fields['Durée estimée'] || record.fields.DureeEstimee || 0,
            heuresReelles: record.fields['Heures réelles'] || record.fields.HeuresReelles || 0,
            status: fromAirtableStatus(record.fields.Statut || record.fields.Status),
            commentaire: record.fields.Commentaire || '',
            order: record.fields.Order || 0,
            dateDebut: record.fields['Date début'] || record.fields.DateDebut || null,
            dateFin: record.fields['Date fin'] || record.fields.DateFin || null,
          };
        });

        // Filtrer par projet si spécifié
        if (projetId) {
          taches = taches.filter(t => t.projetId === projetId);
        }

        taches.sort((a, b) => a.order - b.order);
        return res.status(200).json({ taches });
      }

      if (req.method === 'POST') {
        const { name, projetId, sprint, capitaine, dureeEstimee, heuresReelles, status, commentaire, order, dateDebut, dateFin } = req.body;
        
        console.log('POST tache - received body:', JSON.stringify(req.body));
        
        if (!name) {
          return res.status(400).json({ error: 'Le nom de la tâche est requis' });
        }
        
        // Extraire les IDs (peuvent être tableaux ou strings)
        const projetIdStr = extractId(projetId);
        const capitaineStr = extractId(capitaine);
        
        // Construire les champs - Projet peut être un Linked Record ou un texte
        const fields = {
          'Nom de la tâche': name,
          'Sprint/Phase': sprint || 'Backlog',
          'Statut': toAirtableStatus(status),
          'Commentaire': commentaire || '',
          'Order': order || 0,
        };
        
        // Projet - essayer comme Linked Record (tableau) si c'est un recordId Airtable
        if (projetIdStr) {
          if (isRecordId(projetIdStr)) {
            fields['Projet'] = [projetIdStr];
          } else {
            fields['Projet'] = projetIdStr;
          }
        }
        
        // Capitaine - Linked Record
        if (capitaineStr) {
          if (isRecordId(capitaineStr)) {
            fields['Capitaine'] = [capitaineStr];
          } else {
            fields['Capitaine'] = capitaineStr;
          }
        }
        
        // Durées - seulement si > 0 pour éviter les erreurs
        if (dureeEstimee > 0) fields['Durée estimée'] = dureeEstimee;
        if (heuresReelles > 0) fields['Heures réelles'] = heuresReelles;
        
        // Dates
        if (dateDebut) fields['Date début'] = dateDebut;
        if (dateFin) fields['Date fin'] = dateFin;
        
        console.log('Creating tache with fields:', JSON.stringify(fields));
        console.log('Target table:', TABLES.taches);
        console.log('URL:', getAirtableUrl(TABLES.taches));
        
        const response = await fetch(getAirtableUrl(TABLES.taches), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            records: [{ fields }]
          }),
        });

        const data = await response.json();
        console.log('Airtable response status:', response.status);
        console.log('Airtable response:', JSON.stringify(data));
        
        if (data.error) {
          console.error('Airtable error:', data.error);
          return res.status(400).json({ error: data.error.message || JSON.stringify(data.error) });
        }
        
        if (!data.records || data.records.length === 0) {
          return res.status(500).json({ error: 'Airtable n\'a retourné aucun enregistrement' });
        }

        const record = data.records[0];
        return res.status(201).json({
          tache: {
            id: record.id,
            name: record.fields['Nom de la tâche'] || '',
            projetId: extractId(record.fields.Projet),
            sprint: record.fields['Sprint/Phase'] || 'Backlog',
            capitaine: extractId(record.fields['Capitaine']),
            dureeEstimee: record.fields['Durée estimée'] || 0,
            heuresReelles: record.fields['Heures réelles'] || 0,
            status: fromAirtableStatus(record.fields.Statut),
            commentaire: record.fields.Commentaire || '',
            order: record.fields.Order || 0,
            dateDebut: record.fields['Date début'] || null,
            dateFin: record.fields['Date fin'] || null,
          }
        });
      }

      if (req.method === 'PUT' || req.method === 'PATCH') {
        const { id, name, projetId, sprint, capitaine, dureeEstimee, heuresReelles, status, commentaire, order, dateDebut, dateFin } = req.body;
        if (!id) return res.status(400).json({ error: 'ID requis' });

        // Extraire les IDs (peuvent être tableaux ou strings)
        const projetIdStr = extractId(projetId);
        const capitaineStr = extractId(capitaine);
        
        console.log('PUT/PATCH tache - projetId:', projetId, '-> extracted:', projetIdStr);
        console.log('PUT/PATCH tache - capitaine:', capitaine, '-> extracted:', capitaineStr);

        // Construire les champs
        const fields = {
          'Nom de la tâche': name,
          'Sprint/Phase': sprint || 'Backlog',
          'Statut': toAirtableStatus(status),
          'Commentaire': commentaire || '',
          'Order': order || 0,
        };
        
        // Projet - essayer comme Linked Record (tableau) si c'est un recordId Airtable
        if (projetIdStr) {
          if (isRecordId(projetIdStr)) {
            fields['Projet'] = [projetIdStr];
          } else {
            fields['Projet'] = projetIdStr;
          }
        }
        
        // Capitaine - Linked Record
        if (capitaineStr) {
          if (isRecordId(capitaineStr)) {
            fields['Capitaine'] = [capitaineStr];
          } else {
            fields['Capitaine'] = capitaineStr;
          }
        } else if (capitaine === '' || capitaine === null) {
          fields['Capitaine'] = [];
        }
        
        // Durées
        fields['Durée estimée'] = dureeEstimee || 0;
        fields['Heures réelles'] = heuresReelles || 0;
        
        // Dates - permettre de les vider (null/undefined)
        if (dateDebut !== undefined) fields['Date début'] = dateDebut || null;
        if (dateFin !== undefined) fields['Date fin'] = dateFin || null;
        
        console.log('PATCH tache with fields:', JSON.stringify(fields));

        const response = await fetch(getAirtableUrl(TABLES.taches), {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            records: [{ id, fields }]
          }),
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const record = data.records[0];
        return res.status(200).json({
          tache: {
            id: record.id,
            name: record.fields['Nom de la tâche'] || '',
            projetId: extractId(record.fields.Projet),
            sprint: record.fields['Sprint/Phase'] || 'Backlog',
            capitaine: extractId(record.fields['Capitaine']),
            dureeEstimee: record.fields['Durée estimée'] || 0,
            heuresReelles: record.fields['Heures réelles'] || 0,
            status: fromAirtableStatus(record.fields.Statut),
            commentaire: record.fields.Commentaire || '',
            order: record.fields.Order || 0,
            dateDebut: record.fields['Date début'] || null,
            dateFin: record.fields['Date fin'] || null,
          }
        });
      }

      if (req.method === 'DELETE') {
        const { id } = req.body;
        if (!id) return res.status(400).json({ error: 'ID requis' });

        await fetch(`${getAirtableUrl(TABLES.taches)}?records[]=${id}`, {
          method: 'DELETE',
          headers,
        });

        return res.status(200).json({ success: true });
      }
    }

    // ========== AXES ==========
    if (tableType === 'axes') {
      if (req.method === 'GET') {
        const records = await fetchAllRecords(TABLES.axes, headers);
        
        const axes = records.map(record => ({
          id: record.fields.Id || record.id,
          name: record.fields.Name || '',
          color: record.fields.Color || '#1565C0',
          icon: record.fields.Icon || '🚀',
          order: record.fields.Order || 0,
        }));

        axes.sort((a, b) => a.order - b.order);
        return res.status(200).json({ axes });
      }
    }

    // ========== CHANTIERS ==========
    if (tableType === 'chantiers') {
      if (req.method === 'GET') {
        const records = await fetchAllRecords(TABLES.chantiers, headers);
        
        const chantiers = records.map(record => ({
          id: record.fields.Id || record.id,
          name: record.fields.Name || '',
          axeId: record.fields.AxeId || '',
          color: record.fields.Color || '#1976D2',
          order: record.fields.Order || 0,
        }));

        chantiers.sort((a, b) => a.order - b.order);
        return res.status(200).json({ chantiers });
      }
    }

    // ========== COLLABORATEURS ==========
    if (tableType === 'collaborateurs') {
      if (req.method === 'GET') {
        const records = await fetchAllRecords(TABLES.collaborateurs, headers);
        
        // Créer un mapping recordId -> Id pour résoudre les Linked Records
        const recordIdToId = {};
        records.forEach(record => {
          recordIdToId[record.id] = record.fields.Id || record.id;
        });
        
        const collaborateurs = records.map(record => {
          // Gérer la photo (pièce jointe Airtable)
          const photoField = record.fields.Photo;
          let photoUrl = null;
          if (photoField && Array.isArray(photoField) && photoField.length > 0) {
            photoUrl = photoField[0].thumbnails?.large?.url || photoField[0].url || null;
          }
          
          // Gérer le directeur (Linked Record) - convertir recordId en Id
          let directeurId = null;
          const directeurField = record.fields.Directeur;
          if (directeurField && Array.isArray(directeurField) && directeurField.length > 0) {
            // C'est un recordId Airtable, on le convertit en Id (collab_X)
            const dirRecordId = directeurField[0];
            directeurId = recordIdToId[dirRecordId] || dirRecordId;
          } else if (typeof directeurField === 'string') {
            directeurId = recordIdToId[directeurField] || directeurField;
          }
          
          return {
            id: record.fields.Id || record.id,
            recordId: record.id, // Le vrai recordId Airtable pour les Linked Records
            name: record.fields.Name || '',
            nomComplet: record.fields.NomComplet || record.fields.Name || '',
            role: record.fields.Role || '',
            service: record.fields.Service || '',
            pole: record.fields.Pole || record.fields.Service || '',
            color: record.fields.Color || '#7B1FA2',
            email: record.fields.Email || '',
            photo: photoUrl,
            estDirecteur: toBool(record.fields.EstDirecteur),
            estComiteStrategiqueIA: toBool(record.fields.EstComiteStrategiqueIA),
            estCommissionConformite: toBool(record.fields.EstCommissionConformite),
            peutEtreMeneur: record.fields.PeutEtreMeneur === false ? false : true,
            directeurId: directeurId,
            order: record.fields.Order || 0,
          };
        });

        collaborateurs.sort((a, b) => a.order - b.order);
        return res.status(200).json({ collaborateurs });
      }
    }

    // ========== PARTICIPANTS ==========
    if (tableType === 'participants') {
      if (req.method === 'GET') {
        const { tacheId } = req.query;
        const records = await fetchAllRecords(TABLES.participants, headers);
        
        let participants = records.map(record => {
          // Extraire l'ID de la tâche (Linked Record)
          let tacheIdVal = '';
          const tacheField = record.fields.Tache;
          if (Array.isArray(tacheField) && tacheField.length > 0) {
            tacheIdVal = tacheField[0];
          } else if (typeof tacheField === 'string') {
            tacheIdVal = tacheField;
          }
          
          // Extraire l'ID du collaborateur (Linked Record)
          let collaborateurId = '';
          const collabField = record.fields.Collaborateur;
          if (Array.isArray(collabField) && collabField.length > 0) {
            collaborateurId = collabField[0];
          } else if (typeof collabField === 'string') {
            collaborateurId = collabField;
          }
          
          return {
            id: record.id,
            tacheId: tacheIdVal,
            collaborateurId: collaborateurId,
            heures: record.fields.Heures || 0,
            dateDebut: record.fields.DateDebut || null,
            dateFin: record.fields.DateFin || null,
          };
        });

        // Filtrer par tâche si spécifié
        if (tacheId) {
          participants = participants.filter(p => p.tacheId === tacheId);
        }

        return res.status(200).json({ participants });
      }

      if (req.method === 'POST') {
        const { tacheId, collaborateurId, heures, dateDebut, dateFin } = req.body;
        
        console.log('POST participant - body:', JSON.stringify(req.body));
        console.log('POST participant - tacheId:', tacheId, 'isRecordId:', isRecordId(tacheId));
        console.log('POST participant - collaborateurId:', collaborateurId, 'isRecordId:', isRecordId(collaborateurId));
        
        if (!tacheId || !collaborateurId) {
          return res.status(400).json({ error: 'Tâche et collaborateur requis' });
        }
        
        const fields = {
          'Heures': heures || 0,
        };
        
        // Tache - Linked Record
        if (isRecordId(tacheId)) {
          fields['Tache'] = [tacheId];
        } else {
          console.log('WARNING: tacheId is not a valid recordId:', tacheId);
        }
        
        // Collaborateur - Linked Record
        if (isRecordId(collaborateurId)) {
          fields['Collaborateur'] = [collaborateurId];
        } else {
          console.log('WARNING: collaborateurId is not a valid recordId:', collaborateurId);
        }
        
        // Dates
        if (dateDebut) fields['DateDebut'] = dateDebut;
        if (dateFin) fields['DateFin'] = dateFin;
        
        console.log('POST participant - fields to send:', JSON.stringify(fields));
        
        const response = await fetch(getAirtableUrl(TABLES.participants), {
          method: 'POST',
          headers,
          body: JSON.stringify({ records: [{ fields }] }),
        });

        const data = await response.json();
        console.log('POST participant - Airtable response:', JSON.stringify(data));
        
        if (data.error) {
          return res.status(400).json({ error: data.error.message || JSON.stringify(data.error) });
        }

        const record = data.records[0];
        return res.status(201).json({
          participant: {
            id: record.id,
            tacheId: tacheId,
            collaborateurId: collaborateurId,
            heures: heures || 0,
            dateDebut: dateDebut || null,
            dateFin: dateFin || null,
          }
        });
      }

      if (req.method === 'PUT' || req.method === 'PATCH') {
        const { id, heures, dateDebut, dateFin } = req.body;
        
        if (!id) {
          return res.status(400).json({ error: 'ID requis' });
        }
        
        const fields = {
          'Heures': heures || 0,
        };
        
        if (dateDebut !== undefined) fields['DateDebut'] = dateDebut || null;
        if (dateFin !== undefined) fields['DateFin'] = dateFin || null;

        const response = await fetch(getAirtableUrl(TABLES.participants), {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ records: [{ id, fields }] }),
        });

        const data = await response.json();
        
        if (data.error) {
          return res.status(400).json({ error: data.error.message || JSON.stringify(data.error) });
        }

        return res.status(200).json({ success: true });
      }

      if (req.method === 'DELETE') {
        const { id } = req.query;
        
        if (!id) {
          return res.status(400).json({ error: 'ID requis' });
        }

        const response = await fetch(`${getAirtableUrl(TABLES.participants)}/${id}`, {
          method: 'DELETE',
          headers,
        });

        if (!response.ok) {
          const data = await response.json();
          return res.status(400).json({ error: data.error?.message || 'Erreur suppression' });
        }

        return res.status(200).json({ success: true });
      }
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });

  } catch (error) {
    console.error('Erreur Airtable:', error);
    return res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
}
