-- Migration: 001_create_service_registry.sql
-- Purpose: Create service registry tables for tracking DE services
-- Date: 2025-12-04

-- Core services table
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK(category IN ('llm', 'storage', 'voice', 'image', 'utility', 'auth', 'memory')),
  endpoint TEXT,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'beta', 'deprecated', 'planned')),
  de_worker_name TEXT,
  documentation_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service capabilities (what each service can do)
CREATE TABLE IF NOT EXISTS service_capabilities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  description TEXT,
  input_schema TEXT,
  output_schema TEXT,
  example_input TEXT,
  example_output TEXT,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Service dependencies
CREATE TABLE IF NOT EXISTS service_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id TEXT NOT NULL,
  depends_on_service_id TEXT NOT NULL,
  dependency_type TEXT DEFAULT 'required' CHECK(dependency_type IN ('required', 'optional')),
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- API keys/providers used by services
CREATE TABLE IF NOT EXISTS service_providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  requires_api_key BOOLEAN DEFAULT 1,
  rate_limit_notes TEXT,
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Registry sync log (tracks when registry was updated)
CREATE TABLE IF NOT EXISTS registry_sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  commit_sha TEXT,
  synced_at DATETIME NOT NULL,
  services_added INTEGER DEFAULT 0,
  services_updated INTEGER DEFAULT 0,
  services_removed INTEGER DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_capabilities_service ON service_capabilities(service_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_service ON service_dependencies(service_id);
CREATE INDEX IF NOT EXISTS idx_providers_service ON service_providers(service_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_date ON registry_sync_log(synced_at);
