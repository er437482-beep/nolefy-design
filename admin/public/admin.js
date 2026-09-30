// ===== CONFIGURAÇÃO SUPABASE =====
const SUPABASE_URL = 'https://seu-projeto.supabase.co';
const SUPABASE_ANON_KEY = 'sua-anon-key-aqui';

// ===== STATE =====
let state = {
  user: null,
  token: null,
  currentView: 'services',
  services: [],
  portfolio: [],
  contactInfo: {},
  siteContent: {},
  loading: false,
  message: null,
  messageType: 'error'
};

// ===== ELEMENTOS DOM =====
const app = document.getElementById('app');

// ===== FUNÇÕES AUXILIARES =====
function showMessage(text, type = 'success') {
  state.message = text;
  state.messageType = type;
  render();
  setTimeout(() => {
    state.message = null;
    render();
  }, 4000);
}

function setLoading(isLoading) {
  state.loading = isLoading;
  render();
}

// ===== API CALLS =====
const api = {
  baseURL: 'http://localhost:3000',

  async login(email, password) {
    try {
      setLoading(true);
      const response = await fetch(`${this.baseURL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao fazer login');
      }

      const data = await response.json();
      state.user = data.user;
      state.token = data.access_token;
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      showMessage('Login realizado com sucesso!', 'success');
      render();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  },

  async logout() {
    try {
      setLoading(true);
      await fetch(`${this.baseURL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${state.token}`,
          'Content-Type': 'application/json'
        }
      });

      state.user = null;
      state.token = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      showMessage('Logout realizado com sucesso!', 'success');
      render();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  },

  async getServices() {
    try {
      const response = await fetch(`${this.baseURL}/api/admin/services`, {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });

      if (!response.ok) throw new Error('Erro ao buscar serviços');

      state.services = await response.json();
      render();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  },

  async createService(data) {
    try {
      setLoading(true);
      const response = await fetch(`${this.baseURL}/api/admin/services`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${state.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      await this.getServices();
      showMessage('Serviço criado com sucesso!', 'success');
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  },

  async updateService(id, data) {
    try {
      setLoading(true);
      const response = await fetch(`${this.baseURL}/api/admin/services/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${state.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      await this.getServices();
      showMessage('Serviço atualizado com sucesso!', 'success');
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  },

  async deleteService(id) {
    try {
      if (!confirm('Tem certeza que deseja deletar este serviço?')) return;

      setLoading(true);
      const response = await fetch(`${this.baseURL}/api/admin/services/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${state.token}` }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      await this.getServices();
      showMessage('Serviço deletado com sucesso!', 'success');
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  },

  async getPortfolio() {
    try {
      const response = await fetch(`${this.baseURL}/api/admin/portfolio`, {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });

      if (!response.ok) throw new Error('Erro ao buscar portfólio');

      state.portfolio = await response.json();
      render();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  },

  async createPortfolio(data) {
    try {
      setLoading(true);
      const response = await fetch(`${this.baseURL}/api/admin/portfolio`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${state.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      await this.getPortfolio();
      showMessage('Projeto adicionado com sucesso!', 'success');
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  },

  async updatePortfolio(id, data) {
    try {
      setLoading(true);
      const response = await fetch(`${this.baseURL}/api/admin/portfolio/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${state.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      await this.getPortfolio();
      showMessage('Projeto atualizado com sucesso!', 'success');
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  },

  async deletePortfolio(id) {
    try {
      if (!confirm('Tem certeza que deseja deletar este projeto?')) return;

      setLoading(true);
      const response = await fetch(`${this.baseURL}/api/admin/portfolio/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${state.token}` }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      await this.getPortfolio();
      showMessage('Projeto deletado com sucesso!', 'success');
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  },

  async getContactInfo() {
    try {
      const response = await fetch(`${this.baseURL}/api/admin/contact-info`, {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });

      if (!response.ok) throw new Error('Erro ao buscar informações de contato');

      state.contactInfo = await response.json();
      render();
    } catch (err) {
      showMessage(err.message, 'error');
    }
  },

  async updateContactInfo(data) {
    try {
      setLoading(true);
      const response = await fetch(`${this.baseURL}/api/admin/contact-info`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${state.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      await this.getContactInfo();
      showMessage('Informações de contato atualizadas!', 'success');
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  },

  async uploadImage(file) {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${this.baseURL}/api/admin/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${state.token}` },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      const data = await response.json();
      showMessage('Imagem enviada com sucesso!', 'success');
      return data.url;
    } catch (err) {
      showMessage(err.message, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }
};

// ===== COMPONENTES =====
function LoginPage() {
  const handleSubmit = (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    api.login(email, password);
  };

  return `
    <div class="login-container">
      <div class="login-box">
        <h1>🎨 Admin Nolefy</h1>
        ${state.message ? `<div class="${state.messageType === 'error' ? 'error' : 'success'}-message">${state.message}</div>` : ''}
        <form onsubmit="handleSubmit(event)">
          <div class="form-group">
            <label>Email</label>
            <input type="email" name="email" required />
          </div>
          <div class="form-group">
            <label>Senha</label>
            <input type="password" name="password" required />
          </div>
          <button type="submit" class="btn" ${state.loading ? 'disabled' : ''}>
            ${state.loading ? '<span class="loading"></span>' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  `;
}

function DashboardPage() {
  const handleLogout = () => {
    if (confirm('Tem certeza que deseja fazer logout?')) {
      api.logout();
    }
  };

  return `
    <div class="admin-layout">
      <aside class="sidebar">
        <div class="sidebar-header">
          <h2>🎨 Nolefy</h2>
        </div>
        <nav class="sidebar-nav">
          <li><a href="#" data-view="services" class="${state.currentView === 'services' ? 'active' : ''}">Serviços</a></li>
          <li><a href="#" data-view="portfolio" class="${state.currentView === 'portfolio' ? 'active' : ''}">Portfólio</a></li>
          <li><a href="#" data-view="contact" class="${state.currentView === 'contact' ? 'active' : ''}">Contatos</a></li>
          <li><a href="#" data-view="content" class="${state.currentView === 'content' ? 'active' : ''}">Conteúdo</a></li>
        </nav>
        <div class="sidebar-logout">
          <button class="btn danger" onclick="handleLogout()">Logout</button>
        </div>
      </aside>
      <main class="main-content">
        <div class="header">
          <h1>${getViewTitle()}</h1>
          <div class="user-info">
            <span>${state.user?.email}</span>
          </div>
        </div>
        ${state.message ? `<div class="${state.messageType === 'error' ? 'error' : 'success'}-message">${state.message}</div>` : ''}
        ${renderView()}
      </main>
    </div>
  `;
}

function getViewTitle() {
  const titles = {
    services: 'Serviços',
    portfolio: 'Portfólio',
    contact: 'Contatos e Redes Sociais',
    content: 'Conteúdo do Site'
  };
  return titles[state.currentView] || 'Dashboard';
}

function renderView() {
  switch (state.currentView) {
    case 'services':
      return renderServices();
    case 'portfolio':
      return renderPortfolio();
    case 'contact':
      return renderContact();
    case 'content':
      return renderContent();
    default:
      return '';
  }
}

function renderServices() {
  return `
    <div class="form-container">
      <h2>Adicionar Novo Serviço</h2>
      <form id="serviceForm" class="form-grid">
        <div class="form-group">
          <label>Título</label>
          <input type="text" name="title" required />
        </div>
        <div class="form-group">
          <label>Preço</label>
          <input type="number" name="price" step="0.01" min="0" />
        </div>
        <div class="form-group full-width">
          <label>Descrição</label>
          <textarea name="description" required></textarea>
        </div>
        <div class="button-group">
          <button type="submit" class="btn">Adicionar Serviço</button>
        </div>
      </form>
    </div>
    <div>
      <h2>Serviços Existentes</h2>
      <div class="cards-grid">
        ${state.services.map(service => `
          <div class="card">
            <h3>${service.title}</h3>
            <p>${service.description}</p>
            ${service.price ? `<p><strong>R$ ${parseFloat(service.price).toFixed(2)}</strong></p>` : ''}
            <div class="card-actions">
              <button class="btn secondary" onclick="editService('${service.id}')">Editar</button>
              <button class="btn danger" onclick="deleteService('${service.id}')">Deletar</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderPortfolio() {
  return `
    <div class="form-container">
      <h2>Adicionar Projeto</h2>
      <form id="portfolioForm" class="form-grid">
        <div class="form-group">
          <label>Título</label>
          <input type="text" name="title" required />
        </div>
        <div class="form-group">
          <label>Categoria</label>
          <input type="text" name="category" />
        </div>
        <div class="form-group full-width">
          <label>Descrição</label>
          <textarea name="description"></textarea>
        </div>
        <div class="form-group">
          <label>URL do Projeto</label>
          <input type="url" name="url" />
        </div>
        <div class="form-group">
          <label>Imagem</label>
          <div class="file-upload">
            <input type="file" id="portfolioImage" accept="image/*" />
            <label for="portfolioImage" class="file-upload-label">📁 Clique para fazer upload</label>
          </div>
          <input type="hidden" name="image_url" />
        </div>
        <div class="button-group">
          <button type="submit" class="btn">Adicionar Projeto</button>
        </div>
      </form>
    </div>
    <div>
      <h2>Projetos Existentes</h2>
      <div class="cards-grid">
        ${state.portfolio.map(project => `
          <div class="card">
            ${project.image_url ? `<img src="${project.image_url}" alt="${project.title}" class="image-preview" />` : ''}
            <h3>${project.title}</h3>
            ${project.category ? `<p><strong>Categoria:</strong> ${project.category}</p>` : ''}
            <p>${project.description || ''}</p>
            <div class="card-actions">
              <button class="btn secondary" onclick="editPortfolio('${project.id}')">Editar</button>
              <button class="btn danger" onclick="deletePortfolio('${project.id}')">Deletar</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderContact() {
  const contact = state.contactInfo || {};
  return `
    <div class="form-container">
      <h2>Informações de Contato e Redes Sociais</h2>
      <form id="contactForm" class="form-grid">
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" value="${contact.email || ''}" required />
        </div>
        <div class="form-group">
          <label>Telefone</label>
          <input type="tel" name="phone" value="${contact.phone || ''}" required />
        </div>
        <div class="form-group">
          <label>WhatsApp</label>
          <input type="tel" name="whatsapp" value="${contact.whatsapp || ''}" />
        </div>
        <div class="form-group full-width">
          <label>Endereço</label>
          <textarea name="address">${contact.address || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Instagram</label>
          <input type="text" name="instagram" value="${contact.instagram || ''}" placeholder="@seuinstagram" />
        </div>
        <div class="form-group">
          <label>Facebook</label>
          <input type="text" name="facebook" value="${contact.facebook || ''}" />
        </div>
        <div class="form-group">
          <label>LinkedIn</label>
          <input type="text" name="linkedin" value="${contact.linkedin || ''}" />
        </div>
        <div class="button-group">
          <button type="submit" class="btn">Salvar Informações</button>
        </div>
      </form>
    </div>
  `;
}

function renderContent() {
  return `
    <div class="form-container">
      <h2>Conteúdo Principal</h2>
      <p class="text-muted">Em desenvolvimento...</p>
    </div>
  `;
}

// ===== HANDLERS =====
function handleServiceForm(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  api.createService(data);
  e.target.reset();
}

function deleteService(id) {
  api.deleteService(id);
}

function handlePortfolioForm(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  api.createPortfolio(data);
  e.target.reset();
}

function deletePortfolio(id) {
  api.deletePortfolio(id);
}

function handleContactForm(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const data = Object.fromEntries(formData);
  api.updateContactInfo(data);
}

function handleSubmit(e) {
  e.preventDefault();
  const email = e.target.email.value;
  const password = e.target.password.value;
  api.login(email, password);
}

function editService(id) {
  alert('Funcionalidade de edição em desenvolvimento');
}

function editPortfolio(id) {
  alert('Funcionalidade de edição em desenvolvimento');
}

function handleLogout() {
  if (confirm('Tem certeza que deseja fazer logout?')) {
    api.logout();
  }
}

// ===== RENDER =====
function render() {
  app.innerHTML = state.user ? DashboardPage() : LoginPage();

  // Attach event listeners
  if (state.user) {
    document.querySelectorAll('[data-view]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        state.currentView = link.dataset.view;
        render();
      });
    });

    const serviceForm = document.getElementById('serviceForm');
    if (serviceForm) {
      serviceForm.addEventListener('submit', handleServiceForm);
    }

    const portfolioForm = document.getElementById('portfolioForm');
    if (portfolioForm) {
      portfolioForm.addEventListener('submit', handlePortfolioForm);
    }

    const portfolioImage = document.getElementById('portfolioImage');
    if (portfolioImage) {
      portfolioImage.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          const url = await api.uploadImage(file);
          if (url) {
            document.querySelector('[name="image_url"]').value = url;
          }
        }
      });
    }

    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
      contactForm.addEventListener('submit', handleContactForm);
    }
  }
}

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');

  if (token && user) {
    state.token = token;
    state.user = JSON.parse(user);
    api.getServices();
    api.getPortfolio();
    api.getContactInfo();
  }

  render();
});
