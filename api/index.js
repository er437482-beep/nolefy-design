import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import Joi from 'joi';
import { createClient } from '@supabase/supabase-js';

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const origins = (process.env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
const bucket = process.env.UPLOAD_BUCKET || 'site-assets';

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins.includes(origin)), methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Authorization','Content-Type'] }));
app.use(express.json({ limit: '1mb' }));

const generalLimit = rateLimit({ windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000), max: Number(process.env.RATE_LIMIT_MAX || 60), standardHeaders: true, legacyHeaders: false });
const authLimit = rateLimit({ windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 900000), max: Number(process.env.AUTH_RATE_LIMIT_MAX || 10), standardHeaders: true, legacyHeaders: false });
app.use('/api', generalLimit);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_SIZE || 5242880), files: 1 },
  fileFilter: (req, file, cb) => cb(null, ['image/jpeg','image/png','image/webp','image/svg+xml'].includes(file.mimetype))
});

const id = Joi.string().guid({ version: ['uuidv4','uuidv5'] });
const text = (max) => Joi.string().trim().max(max).allow('');
const serviceSchema = Joi.object({ title: text(120).required(), description: text(1000).required(), price: Joi.number().min(0).max(99999999).allow(null, ''), icon: text(50), sort_order: Joi.number().integer().min(0).max(9999), is_active: Joi.boolean() });
const portfolioSchema = Joi.object({ title: text(120).required(), category: text(80), description: text(1000), image_url: Joi.string().uri({ allowRelative: false }).max(1000).allow(''), project_url: Joi.string().uri({ allowRelative: false }).max(1000).allow(''), sort_order: Joi.number().integer().min(0).max(9999), is_active: Joi.boolean() });
const contactSchema = Joi.object({ email: Joi.string().email().max(254).allow(''), phone: text(40), whatsapp: text(40), address: text(300), instagram: Joi.string().uri().max(500).allow(''), facebook: Joi.string().uri().max(500).allow(''), linkedin: Joi.string().uri().max(500).allow('') });
const contentSchema = Joi.object({ title: text(255), subtitle: text(255), hero_title: text(255), hero_subtitle: text(1000), about_title: text(255), about_text: text(3000), cta_text: text(255), metadata_title: text(255), metadata_description: text(300) });

function token(req) { const value = req.get('authorization') || ''; return value.startsWith('Bearer ') ? value.slice(7).trim() : null; }
async function requireAdmin(req, res, next) {
  try {
    const accessToken = token(req);
    if (!accessToken) return res.status(401).json({ error: 'Autenticação necessária.' });
    const { data: auth, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !auth.user) return res.status(401).json({ error: 'Sessão inválida.' });
    const { data: admin, error } = await supabase.from('admins').select('role').eq('user_id', auth.user.id).maybeSingle();
    if (error || !admin || !['admin','super_admin'].includes(admin.role)) return res.status(403).json({ error: 'Acesso negado.' });
    req.user = auth.user; req.admin = admin; next();
  } catch { res.status(401).json({ error: 'Sessão inválida.' }); }
}
function validate(schema, payload) { const result = schema.validate(payload, { abortEarly: false, stripUnknown: true }); if (result.error) { const error = new Error('Dados inválidos.'); error.status = 400; throw error; } return result.value; }
async function audit(req, action, details = {}) { await supabase.from('admin_activity').insert({ user_id: req.user.id, action, details }); }

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.post('/api/auth/login', authLimit, async (req, res) => {
  try {
    const email = Joi.string().email().max(254).validate(req.body?.email).value;
    const password = req.body?.password;
    if (!email || typeof password !== 'string' || password.length < 8 || password.length > 200) return res.status(400).json({ error: 'Credenciais inválidas.' });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) return res.status(401).json({ error: 'Credenciais inválidas.' });
    const { data: admin } = await supabase.from('admins').select('role').eq('user_id', data.user.id).maybeSingle();
    if (!admin) return res.status(403).json({ error: 'Acesso negado.' });
    await supabase.from('admin_activity').insert({ user_id: data.user.id, action: 'login', details: {} });
    res.json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_at: data.session.expires_at, user: { id: data.user.id, email: data.user.email, role: admin.role } });
  } catch { res.status(500).json({ error: 'Não foi possível entrar.' }); }
});
app.post('/api/auth/logout', requireAdmin, async (req, res) => { await audit(req, 'logout'); res.json({ ok: true }); });

app.get('/api/public/site', async (req, res) => {
  const [content, services, portfolio, contact, socials] = await Promise.all([
    supabase.from('site_content').select('*').eq('section','home').maybeSingle(),
    supabase.from('site_services').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('site_portfolio').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('site_contact').select('*').limit(1).maybeSingle(),
    supabase.from('site_socials').select('*').order('platform')
  ]);
  if (content.error || services.error || portfolio.error || contact.error || socials.error) return res.status(500).json({ error: 'Não foi possível carregar o conteúdo.' });
  res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.json({ content: content.data || {}, services: services.data || [], portfolio: portfolio.data || [], contact: contact.data || {}, socials: socials.data || [] });
});

app.use('/api/admin', requireAdmin);
app.get('/api/admin/me', (req, res) => res.json({ user: { id: req.user.id, email: req.user.email, role: req.admin.role } }));
app.get('/api/admin/content', async (req, res) => { const { data, error } = await supabase.from('site_content').select('*').eq('section','home').maybeSingle(); if (error) return res.status(500).json({ error: 'Erro ao carregar conteúdo.' }); res.json(data || {}); });
app.put('/api/admin/content', async (req, res) => { try { const clean = validate(contentSchema, req.body); const { data, error } = await supabase.from('site_content').upsert({ section: 'home', ...clean }, { onConflict: 'section' }).select().single(); if (error) throw error; await audit(req, 'update_content'); res.json(data); } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Erro ao salvar conteúdo.' }); } });

app.get('/api/admin/services', async (req, res) => { const { data, error } = await supabase.from('site_services').select('*').order('sort_order'); if (error) return res.status(500).json({ error: 'Erro ao carregar serviços.' }); res.json(data || []); });
app.post('/api/admin/services', async (req, res) => { try { const clean = validate(serviceSchema, req.body); const { data, error } = await supabase.from('site_services').insert(clean).select().single(); if (error) throw error; await audit(req, 'create_service', { id: data.id }); res.status(201).json(data); } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Erro ao criar serviço.' }); } });
app.put('/api/admin/services/:id', async (req, res) => { try { const clean = validate(serviceSchema, req.body); const key = await id.validateAsync(req.params.id); const { data, error } = await supabase.from('site_services').update(clean).eq('id', key).select().single(); if (error) throw error; await audit(req, 'update_service', { id: key }); res.json(data); } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Erro ao atualizar serviço.' }); } });
app.delete('/api/admin/services/:id', async (req, res) => { try { const key = await id.validateAsync(req.params.id); const { error } = await supabase.from('site_services').delete().eq('id', key); if (error) throw error; await audit(req, 'delete_service', { id: key }); res.json({ ok: true }); } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Erro ao excluir serviço.' }); } });

app.get('/api/admin/portfolio', async (req, res) => { const { data, error } = await supabase.from('site_portfolio').select('*').order('sort_order'); if (error) return res.status(500).json({ error: 'Erro ao carregar portfólio.' }); res.json(data || []); });
app.post('/api/admin/portfolio', async (req, res) => { try { const clean = validate(portfolioSchema, req.body); const { data, error } = await supabase.from('site_portfolio').insert(clean).select().single(); if (error) throw error; await audit(req, 'create_portfolio', { id: data.id }); res.status(201).json(data); } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Erro ao criar projeto.' }); } });
app.put('/api/admin/portfolio/:id', async (req, res) => { try { const clean = validate(portfolioSchema, req.body); const key = await id.validateAsync(req.params.id); const { data, error } = await supabase.from('site_portfolio').update(clean).eq('id', key).select().single(); if (error) throw error; await audit(req, 'update_portfolio', { id: key }); res.json(data); } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Erro ao atualizar projeto.' }); } });
app.delete('/api/admin/portfolio/:id', async (req, res) => { try { const key = await id.validateAsync(req.params.id); const { error } = await supabase.from('site_portfolio').delete().eq('id', key); if (error) throw error; await audit(req, 'delete_portfolio', { id: key }); res.json({ ok: true }); } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Erro ao excluir projeto.' }); } });

app.get('/api/admin/contact', async (req, res) => { const { data, error } = await supabase.from('site_contact').select('*').limit(1).maybeSingle(); if (error) return res.status(500).json({ error: 'Erro ao carregar contato.' }); res.json(data || {}); });
app.put('/api/admin/contact', async (req, res) => { try { const clean = validate(contactSchema, req.body); const current = await supabase.from('site_contact').select('id').limit(1).maybeSingle(); const payload = current.data?.id ? { id: current.data.id, ...clean } : clean; const { data, error } = await supabase.from('site_contact').upsert(payload).select().single(); if (error) throw error; await audit(req, 'update_contact'); res.json(data); } catch (e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Erro ao salvar contato.' }); } });

app.post('/api/admin/upload', upload.single('image'), async (req, res) => { try { if (!req.file) return res.status(400).json({ error: 'Envie uma imagem válida.' }); const extension = ({ 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'image/svg+xml':'svg' })[req.file.mimetype]; if (!extension) return res.status(400).json({ error: 'Formato não permitido.' }); const path = `${req.user.id}/${crypto.randomUUID()}.${extension}`; const { error } = await supabase.storage.from(bucket).upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: false }); if (error) throw error; const { data } = supabase.storage.from(bucket).getPublicUrl(path); await audit(req, 'upload_image'); res.status(201).json({ url: data.publicUrl }); } catch { res.status(500).json({ error: 'Erro ao enviar imagem.' }); } });

app.use((err, req, res, next) => { console.error(err); if (err instanceof multer.MulterError) return res.status(400).json({ error: 'Upload inválido.' }); res.status(500).json({ error: 'Erro interno.' }); });
export default app;
