-- RLS policies para logistica_checks (mesmo padrão do resto do sistema)
CREATE POLICY "auth_logck" ON logistica_checks FOR ALL TO authenticated USING (true) WITH CHECK (true);
