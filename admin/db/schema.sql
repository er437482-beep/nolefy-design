-- ===== SCHEMA SEGURO COM ROW LEVEL SECURITY (RLS) =====

-- Tabela de administradores
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) CHECK (role IN ('admin', 'super_admin')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de conteúdo do site
CREATE TABLE IF NOT EXISTS site_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content TEXT,
  image_url TEXT,
  published BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de serviços
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(50),
  price DECIMAL(10, 2) DEFAULT 0.00,
  "order" INT DEFAULT 0,
  published BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de portfólio
CREATE TABLE IF NOT EXISTS portfolio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  category VARCHAR(100),
  url TEXT,
  "order" INT DEFAULT 0,
  published BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de informações de contato
CREATE TABLE IF NOT EXISTS contact_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address TEXT,
  whatsapp VARCHAR(20),
  instagram VARCHAR(100),
  facebook VARCHAR(100),
  linkedin VARCHAR(100),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action VARCHAR(100) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  status VARCHAR(50) DEFAULT 'success',
  created_at TIMESTAMP DEFAULT NOW()
);

-- ===== ROW LEVEL SECURITY (RLS) =====

-- Habilitar RLS em todas as tabelas
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- POLÍTICA: Admins podem ver seus próprios dados
CREATE POLICY "admins_read_own" ON admins
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "admins_super_read_all" ON admins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- POLÍTICA: Site content - público pode ler publicado, admin pode atualizar
CREATE POLICY "site_content_read_public" ON site_content
  FOR SELECT
  USING (published = TRUE OR auth.uid() IN (SELECT user_id FROM admins));

CREATE POLICY "site_content_update_admin" ON site_content
  FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM admins))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admins));

CREATE POLICY "site_content_insert_admin" ON site_content
  FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admins));

CREATE POLICY "site_content_delete_super" ON site_content
  FOR DELETE
  USING (auth.uid() IN (SELECT user_id FROM admins WHERE role = 'super_admin'));

-- POLÍTICA: Services - público pode ler publicado, admin pode atualizar
CREATE POLICY "services_read_public" ON services
  FOR SELECT
  USING (published = TRUE OR auth.uid() IN (SELECT user_id FROM admins));

CREATE POLICY "services_update_admin" ON services
  FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM admins))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admins));

CREATE POLICY "services_insert_admin" ON services
  FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admins));

CREATE POLICY "services_delete_super" ON services
  FOR DELETE
  USING (auth.uid() IN (SELECT user_id FROM admins WHERE role = 'super_admin'));

-- POLÍTICA: Portfolio - público pode ler publicado, admin pode atualizar
CREATE POLICY "portfolio_read_public" ON portfolio
  FOR SELECT
  USING (published = TRUE OR auth.uid() IN (SELECT user_id FROM admins));

CREATE POLICY "portfolio_update_admin" ON portfolio
  FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM admins))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admins));

CREATE POLICY "portfolio_insert_admin" ON portfolio
  FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admins));

CREATE POLICY "portfolio_delete_super" ON portfolio
  FOR DELETE
  USING (auth.uid() IN (SELECT user_id FROM admins WHERE role = 'super_admin'));

-- POLÍTICA: Contact info - público pode ler, admin pode atualizar
CREATE POLICY "contact_info_read_public" ON contact_info
  FOR SELECT
  USING (TRUE);

CREATE POLICY "contact_info_update_admin" ON contact_info
  FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM admins))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admins));

CREATE POLICY "contact_info_upsert_admin" ON contact_info
  FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admins));

-- POLÍTICA: Audit logs - apenas super admin pode ler
CREATE POLICY "audit_logs_read_super" ON audit_logs
  FOR SELECT
  USING (auth.uid() IN (SELECT user_id FROM admins WHERE role = 'super_admin'));

CREATE POLICY "audit_logs_insert_admin" ON audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admins));

-- ===== ÍNDICES para performance =====
CREATE INDEX IF NOT EXISTS idx_site_content_published ON site_content(published);
CREATE INDEX IF NOT EXISTS idx_site_content_section ON site_content(section);
CREATE INDEX IF NOT EXISTS idx_services_published ON services(published);
CREATE INDEX IF NOT EXISTS idx_portfolio_published ON portfolio(published);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_admins_user_id ON admins(user_id);

-- ===== FUNÇÕES SEGURAS =====

-- Função para atualizar timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger de timestamp
CREATE TRIGGER update_site_content_timestamp BEFORE UPDATE ON site_content FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_services_timestamp BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_portfolio_timestamp BEFORE UPDATE ON portfolio FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_contact_info_timestamp BEFORE UPDATE ON contact_info FOR EACH ROW EXECUTE FUNCTION update_timestamp();
