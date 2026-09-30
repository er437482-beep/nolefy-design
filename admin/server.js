import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ===== SEGURANÇA: Helmet para headers HTTP seguros =====
app.use(helmet());

// ===== SEGURANÇA: CORS restritivo =====
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type']
}));

// ===== MIDDLEWARE: Parsers =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ===== SUPABASE =====
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // NUNCA exponha isso no frontend!
);

// ===== SEGURANÇA: Rate Limiting =====
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS),
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS'
});

// ===== SEGURANÇA: Multer para upload de arquivos =====
const upload = multer({
  limits: { fileSize: parseInt(process.env.MAX_UPLOAD_SIZE) || 5242880 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = process.env.ALLOWED_IMAGE_TYPES?.split(',') || ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  }
});

// ===== MIDDLEWARE: Validação de token =====
const validateToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Verificar se o usuário é administrador
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (adminError || !admin) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    req.user = user;
    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// ===== ROTA: Health check =====
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ===== ROTA: Login (com rate limiting) =====
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Supabase Auth lida com a senha de forma segura (nunca armazenada em texto puro)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      // Não revelar se o email existe ou se a senha está errada
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Verificar se o usuário é administrador
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('role')
      .eq('user_id', data.user.id)
      .single();

    if (adminError || !admin) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Registrar login bem-sucedido
    await supabase.from('audit_logs').insert({
      user_id: data.user.id,
      action: 'LOGIN',
      details: { email },
      ip_address: req.ip,
      status: 'success'
    });

    res.json({
      message: 'Login realizado com sucesso',
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: admin.role
      }
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== ROTA: Logout =====
app.post('/api/auth/logout', validateToken, async (req, res) => {
  try {
    await supabase.auth.signOut();

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'LOGOUT',
      details: {},
      ip_address: req.ip,
      status: 'success'
    });

    res.json({ message: 'Logout realizado com sucesso' });
  } catch (err) {
    console.error('Erro no logout:', err);
    res.status(500).json({ error: 'Erro ao fazer logout' });
  }
});

// ===== ROTA: Obter dados públicos do site =====
app.get('/api/site-content', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('site_content')
      .select('*')
      .eq('published', true);

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar conteúdo' });
  }
});

// ===== ROTA: Atualizar conteúdo (apenas admin) =====
app.put('/api/admin/site-content/:id', validateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, content, image_url, section } = req.body;

    // Validação básica
    if (!title || !section) {
      return res.status(400).json({ error: 'Título e seção são obrigatórios' });
    }

    const { data, error } = await supabase
      .from('site_content')
      .update({
        title: title.substring(0, 255),
        description: description?.substring(0, 1000),
        content: content?.substring(0, 5000),
        image_url,
        updated_at: new Date()
      })
      .eq('id', id)
      .select();

    if (error) throw error;

    // Registrar alteração
    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'UPDATE_CONTENT',
      details: { content_id: id, section },
      ip_address: req.ip,
      status: 'success'
    });

    res.json({ message: 'Conteúdo atualizado com sucesso', data });
  } catch (err) {
    console.error('Erro ao atualizar conteúdo:', err);
    res.status(500).json({ error: 'Erro ao atualizar conteúdo' });
  }
});

// ===== ROTA: Upload de imagem (apenas admin) =====
app.post('/api/admin/upload', validateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo foi enviado' });
    }

    const fileName = `admin/${req.user.id}/${Date.now()}-${req.file.originalname}`;

    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(fileName);

    // Registrar upload
    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'UPLOAD_IMAGE',
      details: { file_name: req.file.originalname, file_size: req.file.size },
      ip_address: req.ip,
      status: 'success'
    });

    res.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error('Erro no upload:', err);
    res.status(500).json({ error: 'Erro ao fazer upload do arquivo' });
  }
});

// ===== ROTA: Obter serviços =====
app.get('/api/admin/services', validateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('order', { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar serviços' });
  }
});

// ===== ROTA: Criar serviço =====
app.post('/api/admin/services', validateToken, async (req, res) => {
  try {
    const { title, description, price, icon } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Título e descrição são obrigatórios' });
    }

    const { data, error } = await supabase
      .from('services')
      .insert({
        title: title.substring(0, 255),
        description: description.substring(0, 1000),
        price: parseFloat(price) || 0,
        icon: icon?.substring(0, 50),
        created_by: req.user.id
      })
      .select();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'CREATE_SERVICE',
      details: { service_id: data[0].id, title },
      ip_address: req.ip,
      status: 'success'
    });

    res.json({ message: 'Serviço criado com sucesso', data: data[0] });
  } catch (err) {
    console.error('Erro ao criar serviço:', err);
    res.status(500).json({ error: 'Erro ao criar serviço' });
  }
});

// ===== ROTA: Atualizar serviço =====
app.put('/api/admin/services/:id', validateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, icon } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Título e descrição são obrigatórios' });
    }

    const { data, error } = await supabase
      .from('services')
      .update({
        title: title.substring(0, 255),
        description: description.substring(0, 1000),
        price: parseFloat(price) || 0,
        icon: icon?.substring(0, 50),
        updated_at: new Date()
      })
      .eq('id', id)
      .select();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'UPDATE_SERVICE',
      details: { service_id: id, title },
      ip_address: req.ip,
      status: 'success'
    });

    res.json({ message: 'Serviço atualizado com sucesso', data: data[0] });
  } catch (err) {
    console.error('Erro ao atualizar serviço:', err);
    res.status(500).json({ error: 'Erro ao atualizar serviço' });
  }
});

// ===== ROTA: Deletar serviço =====
app.delete('/api/admin/services/:id', validateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('services')
      .delete()
      .eq('id', id)
      .select();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'DELETE_SERVICE',
      details: { service_id: id },
      ip_address: req.ip,
      status: 'success'
    });

    res.json({ message: 'Serviço deletado com sucesso' });
  } catch (err) {
    console.error('Erro ao deletar serviço:', err);
    res.status(500).json({ error: 'Erro ao deletar serviço' });
  }
});

// ===== ROTA: Obter portfólio =====
app.get('/api/admin/portfolio', validateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('portfolio')
      .select('*')
      .order('order', { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar portfólio' });
  }
});

// ===== ROTA: Criar projeto de portfólio =====
app.post('/api/admin/portfolio', validateToken, async (req, res) => {
  try {
    const { title, description, image_url, category, url } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Título é obrigatório' });
    }

    const { data, error } = await supabase
      .from('portfolio')
      .insert({
        title: title.substring(0, 255),
        description: description?.substring(0, 1000),
        image_url,
        category: category?.substring(0, 100),
        url: url?.substring(0, 500),
        created_by: req.user.id
      })
      .select();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'CREATE_PORTFOLIO',
      details: { portfolio_id: data[0].id, title },
      ip_address: req.ip,
      status: 'success'
    });

    res.json({ message: 'Projeto adicionado com sucesso', data: data[0] });
  } catch (err) {
    console.error('Erro ao criar projeto:', err);
    res.status(500).json({ error: 'Erro ao criar projeto' });
  }
});

// ===== ROTA: Atualizar projeto de portfólio =====
app.put('/api/admin/portfolio/:id', validateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, image_url, category, url } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Título é obrigatório' });
    }

    const { data, error } = await supabase
      .from('portfolio')
      .update({
        title: title.substring(0, 255),
        description: description?.substring(0, 1000),
        image_url,
        category: category?.substring(0, 100),
        url: url?.substring(0, 500),
        updated_at: new Date()
      })
      .eq('id', id)
      .select();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'UPDATE_PORTFOLIO',
      details: { portfolio_id: id, title },
      ip_address: req.ip,
      status: 'success'
    });

    res.json({ message: 'Projeto atualizado com sucesso', data: data[0] });
  } catch (err) {
    console.error('Erro ao atualizar projeto:', err);
    res.status(500).json({ error: 'Erro ao atualizar projeto' });
  }
});

// ===== ROTA: Deletar projeto de portfólio =====
app.delete('/api/admin/portfolio/:id', validateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('portfolio')
      .delete()
      .eq('id', id)
      .select();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'DELETE_PORTFOLIO',
      details: { portfolio_id: id },
      ip_address: req.ip,
      status: 'success'
    });

    res.json({ message: 'Projeto deletado com sucesso' });
  } catch (err) {
    console.error('Erro ao deletar projeto:', err);
    res.status(500).json({ error: 'Erro ao deletar projeto' });
  }
});

// ===== ROTA: Obter informações de contato =====
app.get('/api/admin/contact-info', validateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('contact_info')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json(data || {});
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar informações de contato' });
  }
});

// ===== ROTA: Atualizar informações de contato =====
app.put('/api/admin/contact-info', validateToken, async (req, res) => {
  try {
    const { email, phone, address, whatsapp, instagram, facebook, linkedin } = req.body;

    if (!email || !phone) {
      return res.status(400).json({ error: 'Email e telefone são obrigatórios' });
    }

    // Validação de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    const { data, error } = await supabase
      .from('contact_info')
      .upsert({
        email: email.substring(0, 255),
        phone: phone.substring(0, 20),
        address: address?.substring(0, 500),
        whatsapp: whatsapp?.substring(0, 20),
        instagram: instagram?.substring(0, 100),
        facebook: facebook?.substring(0, 100),
        linkedin: linkedin?.substring(0, 100),
        updated_at: new Date(),
        updated_by: req.user.id
      }, { onConflict: 'id' })
      .select();

    if (error) throw error;

    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'UPDATE_CONTACT_INFO',
      details: { email },
      ip_address: req.ip,
      status: 'success'
    });

    res.json({ message: 'Informações de contato atualizadas com sucesso', data: data[0] });
  } catch (err) {
    console.error('Erro ao atualizar informações de contato:', err);
    res.status(500).json({ error: 'Erro ao atualizar informações de contato' });
  }
});

// ===== ROTA: Obter logs de auditoria (apenas admin super) =====
app.get('/api/admin/audit-logs', validateToken, async (req, res) => {
  try {
    // Apenas super admin pode ver todos os logs
    if (req.admin.role !== 'super_admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar logs de auditoria' });
  }
});

// ===== MIDDLEWARE: Tratamento de erros =====
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);

  // Multer error
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'Erro ao fazer upload do arquivo' });
  }

  // Erro geral
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ===== ROTA: 404 =====
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ===== INICIAR SERVIDOR =====
app.listen(PORT, () => {
  console.log(`✅ Servidor iniciado em http://localhost:${PORT}`);
  console.log(`📋 Ambiente: ${process.env.NODE_ENV}`);
  console.log(`🔒 Rate limiting: ${process.env.RATE_LIMIT_MAX_REQUESTS} requisições a cada ${process.env.RATE_LIMIT_WINDOW} minutos`);
});
