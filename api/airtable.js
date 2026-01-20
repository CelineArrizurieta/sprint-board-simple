// API Route Vercel pour Airtable - Sprint Board Simplifié
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

// Tables - IDs Airtable
const TABLES = {
  items: 'tblcIBoB5nl6PDCfn',
  sprints: 'tblSFNt5dWgiU89g2',
  axes: 'tblBwHP0Ft9pkntyy',
  chantiers: 'tblIkKyzPB7u8NWzI',
  collaborateurs: 'tblVtL5KEJQmxBra3', // Nouvelle table Collaborateurs (20 jan 2026)
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

  try {
    // ========== ITEMS (Projets) ==========
    if (tableType === 'items') {
      if (req.method === 'GET') {
        const records = await fetchAllRecords(TABLES.items, headers);
        
        // Helper pour parser les collaborateurs (peut être un objet par rôle ou un tableau simple)
        const parseCollaborateurs = (val) => {
          if (!val) return [];
          try {
            const parsed = typeof val === 'string' ? JSON.parse(val) : val;
            // Si c'est un objet avec des rôles, extraire tous les IDs
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              const allIds = [];
              Object.values(parsed).forEach(v => {
                if (Array.isArray(v)) allIds.push(...v);
                else if (typeof v === 'string') allIds.push(v);
              });
              return [...new Set(allIds)]; // Dédupliquer
            }
            return Array.isArray(parsed) ? parsed : [];
          } catch { return []; }
        };
        
        const items = records.map(record => ({
          id: record.id,
          name: record.fields.Name || '',
          chantierId: record.fields.ChantierId || '',
          weekStart: record.fields.WeekStart || 1,
          weekEnd: record.fields.WeekEnd || record.fields.WeekStart || 1,
          collaborateurs: parseCollaborateurs(record.fields.CollaborateursParRole),
          status: record.fields.Status || 'todo',
          commentaire: record.fields.Commentaire || '',
          avancement: record.fields.Avancement || 0,
          // Nouveaux champs équipe de cycle
          referentComiteIA: record.fields.ReferentComiteIA || '',
          referentConformite: record.fields.ReferentConformite || '',
          meneur: record.fields.Meneur || '',
        }));

        return res.status(200).json({ items });
      }

      if (req.method === 'POST') {
        const { name, chantierId, weekStart, weekEnd, collaborateurs, status, commentaire, avancement, referentComiteIA, referentConformite, meneur } = req.body;
        
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
        
        // Helper pour parser les collaborateurs
        const parseCollabs = (val) => {
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
        
        return res.status(201).json({
          item: {
            id: record.id,
            name: record.fields.Name,
            chantierId: record.fields.ChantierId,
            weekStart: record.fields.WeekStart,
            weekEnd: record.fields.WeekEnd,
            collaborateurs: parseCollabs(record.fields.CollaborateursParRole),
            status: record.fields.Status,
            commentaire: record.fields.Commentaire || '',
            avancement: record.fields.Avancement || 0,
            referentComiteIA: record.fields.ReferentComiteIA || '',
            referentConformite: record.fields.ReferentConformite || '',
            meneur: record.fields.Meneur || '',
          }
        });
      }

      if (req.method === 'PUT' || req.method === 'PATCH') {
        const { id, name, chantierId, weekStart, weekEnd, collaborateurs, status, commentaire, avancement, referentComiteIA, referentConformite, meneur } = req.body;
        if (!id) return res.status(400).json({ error: 'ID requis' });

        const response = await fetch(getAirtableUrl(TABLES.items), {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            records: [{
              id,
              fields: {
                Name: name,
                ChantierId: chantierId,
                WeekStart: weekStart || 1,
                WeekEnd: weekEnd || weekStart || 1,
                CollaborateursParRole: JSON.stringify(collaborateurs || []),
                Status: status || 'todo',
                Commentaire: commentaire || '',
                Avancement: avancement || 0,
                ReferentComiteIA: referentComiteIA || '',
                ReferentConformite: referentConformite || '',
                Meneur: meneur || '',
              }
            }]
          }),
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        // Helper pour parser les collaborateurs
        const parseCollabs = (val) => {
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

        const record = data.records[0];
        return res.status(200).json({
          item: {
            id: record.id,
            name: record.fields.Name,
            chantierId: record.fields.ChantierId,
            weekStart: record.fields.WeekStart,
            weekEnd: record.fields.WeekEnd,
            collaborateurs: parseCollabs(record.fields.CollaborateursParRole),
            status: record.fields.Status,
            commentaire: record.fields.Commentaire || '',
            avancement: record.fields.Avancement || 0,
            referentComiteIA: record.fields.ReferentComiteIA || '',
            referentConformite: record.fields.ReferentConformite || '',
            meneur: record.fields.Meneur || '',
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
        
        // Fonction helper pour convertir les checkboxes Airtable (true ou "checked") en boolean
        const toBool = (val) => val === true || val === 'checked' || val === 'TRUE' || val === true;
        
        const collaborateurs = records.map(record => ({
          id: record.fields.Id || record.id,
          name: record.fields.Name || '',
          nomComplet: record.fields.NomComplet || record.fields.Name || '',
          role: record.fields.Role || '',
          service: record.fields.Service || '',
          color: record.fields.Color || '#7B1FA2',
          email: record.fields.Email || '',
          // Champs booléens - gérer les différents formats Airtable
          estDirecteur: toBool(record.fields.EstDirecteur),
          estComiteStrategiqueIA: toBool(record.fields.EstComiteStrategiqueIA),
          estCommissionConformite: toBool(record.fields.EstCommissionConformite),
          peutEtreMeneur: record.fields.PeutEtreMeneur === false ? false : true, // Par défaut true
          order: record.fields.Order || 0,
        }));

        collaborateurs.sort((a, b) => a.order - b.order);
        return res.status(200).json({ collaborateurs });
      }
    }

    return res.status(405).json({ error: 'Méthode non autorisée' });

  } catch (error) {
    console.error('Erreur Airtable:', error);
    return res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
}
