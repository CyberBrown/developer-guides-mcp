-- Migration: 002_seed_service_registry.sql
-- Purpose: Seed initial DE services data
-- Date: 2025-12-04

-- Insert known DE services
INSERT OR REPLACE INTO services (id, name, description, category, status, de_worker_name, documentation_url) VALUES
  ('text-gen', 'Text Generation', 'LLM text generation via OpenAI/Anthropic/Gemini providers', 'llm', 'active', 'text-gen', NULL),
  ('image-gen', 'Image Generation', 'Image generation via Ideogram API', 'image', 'active', 'image-gen', 'https://developer.ideogram.ai'),
  ('config-service', 'Config Service', 'Central configuration management for the worker swarm', 'utility', 'active', 'config-service', NULL),
  ('voice-to-text', 'Voice to Text', 'Speech transcription service', 'voice', 'planned', 'voice-to-text', NULL),
  ('text-to-voice', 'Text to Voice', 'Text-to-speech synthesis', 'voice', 'planned', 'text-to-voice', NULL),
  ('mnemo', 'Mnemo Working Memory', 'Real-time context curation and conversation history', 'memory', 'beta', 'mnemo', NULL),
  ('nexus', 'Nexus Long-term Memory', 'Strategic memory and decision pattern storage', 'memory', 'planned', 'nexus', NULL);

-- Add capabilities for text-gen
INSERT OR REPLACE INTO service_capabilities (service_id, capability, description, input_schema, output_schema) VALUES
  ('text-gen', 'chat_completion', 'Generate chat responses with conversation history',
   '{"messages": [{"role": "string", "content": "string"}], "model": "string", "max_tokens": "number"}',
   '{"content": "string", "usage": {"prompt_tokens": "number", "completion_tokens": "number"}}'),
  ('text-gen', 'text_completion', 'Generate text completions from a prompt',
   '{"prompt": "string", "model": "string", "max_tokens": "number"}',
   '{"text": "string", "usage": {"prompt_tokens": "number", "completion_tokens": "number"}}'),
  ('text-gen', 'streaming_chat', 'Stream chat responses in real-time',
   '{"messages": [{"role": "string", "content": "string"}], "model": "string", "stream": true}',
   'Server-sent events stream');

-- Add capabilities for image-gen
INSERT OR REPLACE INTO service_capabilities (service_id, capability, description, input_schema, output_schema) VALUES
  ('image-gen', 'generate_image', 'Generate images from text prompts',
   '{"prompt": "string", "aspect_ratio": "string", "model": "string", "magic_prompt_option": "string"}',
   '{"images": [{"url": "string", "seed": "number"}]}'),
  ('image-gen', 'remix_image', 'Generate variations of an existing image',
   '{"image_url": "string", "prompt": "string", "strength": "number"}',
   '{"images": [{"url": "string"}]}');

-- Add capabilities for config-service
INSERT OR REPLACE INTO service_capabilities (service_id, capability, description) VALUES
  ('config-service', 'get_config', 'Retrieve configuration values by key'),
  ('config-service', 'set_config', 'Update configuration values'),
  ('config-service', 'list_configs', 'List all configuration keys for an instance');

-- Add capabilities for mnemo
INSERT OR REPLACE INTO service_capabilities (service_id, capability, description) VALUES
  ('mnemo', 'store_context', 'Store conversation context for later retrieval'),
  ('mnemo', 'retrieve_context', 'Retrieve relevant context based on current conversation'),
  ('mnemo', 'preemptive_load', 'Proactively load context based on conversation topics');

-- Add providers
INSERT OR REPLACE INTO service_providers (service_id, provider_name, requires_api_key, rate_limit_notes) VALUES
  ('text-gen', 'openai', 1, 'Rate limits vary by tier: Free=3 RPM, Tier 1=500 RPM'),
  ('text-gen', 'anthropic', 1, 'Rate limits: 50 RPM for Claude 3'),
  ('text-gen', 'gemini', 1, 'Rate limits: 60 RPM for Gemini Pro'),
  ('image-gen', 'ideogram', 1, 'Rate limits: Based on subscription tier'),
  ('mnemo', 'gemini', 1, 'Uses Gemini for context curation - special handling');

-- Add dependencies
INSERT OR REPLACE INTO service_dependencies (service_id, depends_on_service_id, dependency_type) VALUES
  ('mnemo', 'text-gen', 'optional'),
  ('nexus', 'mnemo', 'optional');

-- Log initial sync
INSERT INTO registry_sync_log (source, commit_sha, synced_at, services_added) VALUES
  ('initial-seed', 'manual', datetime('now'), 7);
