
CREATE TABLE public.ncm_monofasico_pis_cofins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ncm_prefixo text NOT NULL,
  descricao text NOT NULL,
  grupo text NOT NULL,
  cst_esperado text NOT NULL DEFAULT '04',
  cst_alternativos text[] NOT NULL DEFAULT ARRAY['04','06'],
  base_legal text NOT NULL,
  observacao text,
  fonte text NOT NULL DEFAULT 'Tabela 4.3.10 (EFD-Contribuicoes) e legislacao correlata',
  vigencia_inicio date NOT NULL DEFAULT '2000-01-01',
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ncm_prefixo, grupo)
);

GRANT SELECT ON public.ncm_monofasico_pis_cofins TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ncm_monofasico_pis_cofins TO authenticated;
GRANT ALL ON public.ncm_monofasico_pis_cofins TO service_role;
ALTER TABLE public.ncm_monofasico_pis_cofins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Catalogo monofasico e publicamente legivel"
  ON public.ncm_monofasico_pis_cofins FOR SELECT USING (true);
CREATE POLICY "Equipe autenticada mantem catalogo monofasico"
  ON public.ncm_monofasico_pis_cofins FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.caso_monofasico_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  arquivo_original text NOT NULL,
  chave_acesso text,
  modelo text,
  numero_nota text,
  data_emissao timestamptz,
  competencia text,
  ncm text,
  cfop text,
  descricao text,
  valor_item numeric NOT NULL DEFAULT 0,
  cst_pis text,
  cst_cofins text,
  valor_pis numeric NOT NULL DEFAULT 0,
  valor_cofins numeric NOT NULL DEFAULT 0,
  grupo text,
  classificacao text NOT NULL,
  regime text NOT NULL,
  indebito_estimado numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_caso_monofasico_item_case ON public.caso_monofasico_item (case_id);
CREATE INDEX idx_caso_monofasico_item_ncm ON public.caso_monofasico_item (case_id, ncm);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caso_monofasico_item TO authenticated;
GRANT ALL ON public.caso_monofasico_item TO service_role;
ALTER TABLE public.caso_monofasico_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe autenticada gerencia itens monofasicos"
  ON public.caso_monofasico_item FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.ncm_monofasico_pis_cofins (ncm_prefixo, descricao, grupo, cst_esperado, base_legal, observacao) VALUES
('3003', 'Medicamentos (nao dosificados) de uso humano', 'Medicamentos', '04', 'Lei 10.147/2000, art. 1o, I, a', 'Revenda com aliquota zero; excecoes da lista positiva/negativa exigem conferencia'),
('3004', 'Medicamentos dosificados de uso humano', 'Medicamentos', '04', 'Lei 10.147/2000, art. 1o, I, a', 'Medicamentos veterinarios (uso animal) nao sao monofasicos'),
('3006', 'Preparacoes e artigos farmaceuticos diversos', 'Medicamentos', '04', 'Lei 10.147/2000, art. 1o, I, a', 'Conferir subposicao: nem todo 3006 esta na lista'),
('3303', 'Perfumes e aguas de colonia', 'Perfumaria e cosmeticos', '04', 'Lei 10.147/2000, art. 1o, I, b', NULL),
('3304', 'Produtos de beleza e maquiagem', 'Perfumaria e cosmeticos', '04', 'Lei 10.147/2000, art. 1o, I, b', NULL),
('3305', 'Preparacoes capilares (xampus, condicionadores)', 'Perfumaria e cosmeticos', '04', 'Lei 10.147/2000, art. 1o, I, b', NULL),
('3307', 'Preparacoes para barbear, desodorantes e banho', 'Perfumaria e cosmeticos', '04', 'Lei 10.147/2000, art. 1o, I, b', NULL),
('34011190', 'Saboes de toucador', 'Perfumaria e cosmeticos', '04', 'Lei 10.147/2000, art. 1o, I, b', 'Somente sabao de toucador; sabao comum e tributado'),
('34012010', 'Saboes de toucador em outras formas', 'Perfumaria e cosmeticos', '04', 'Lei 10.147/2000, art. 1o, I, b', NULL),
('96032100', 'Escovas de dentes', 'Perfumaria e cosmeticos', '04', 'Lei 10.147/2000, art. 1o, I, b', NULL),
('4011', 'Pneumaticos novos de borracha', 'Pneus e cameras de ar', '04', 'Lei 10.485/2002, art. 5o', NULL),
('4013', 'Camaras de ar de borracha', 'Pneus e cameras de ar', '04', 'Lei 10.485/2002, art. 5o', NULL),
('8708', 'Partes e acessorios de veiculos automoveis', 'Autopecas', '04', 'Lei 10.485/2002, Anexos I e II', 'Verificar se a subposicao consta dos Anexos I/II'),
('8714', 'Partes e acessorios de motocicletas e bicicletas', 'Autopecas', '04', 'Lei 10.485/2002, Anexos I e II', NULL),
('8507', 'Acumuladores eletricos (baterias automotivas)', 'Autopecas', '04', 'Lei 10.485/2002, Anexo I', 'Restrito as baterias de partida listadas no Anexo I'),
('8511', 'Aparelhos e dispositivos eletricos de ignicao', 'Autopecas', '04', 'Lei 10.485/2002, Anexo I', NULL),
('8512', 'Aparelhos de iluminacao e sinalizacao automotiva', 'Autopecas', '04', 'Lei 10.485/2002, Anexo I', NULL),
('8483', 'Arvores de transmissao, engrenagens e embreagens', 'Autopecas', '04', 'Lei 10.485/2002, Anexo I', 'Conferir subposicao no Anexo I'),
('8409', 'Partes de motores de pistao', 'Autopecas', '04', 'Lei 10.485/2002, Anexo I', 'Conferir subposicao no Anexo I'),
('2201', 'Aguas minerais e gaseificadas', 'Bebidas frias', '04', 'Lei 13.097/2015, art. 14', NULL),
('2202', 'Refrigerantes, energeticos e bebidas nao alcoolicas', 'Bebidas frias', '04', 'Lei 13.097/2015, art. 14', NULL),
('2203', 'Cervejas de malte', 'Bebidas frias', '04', 'Lei 13.097/2015, art. 14', NULL),
('21069010', 'Preparacoes compostas para elaboracao de bebidas', 'Bebidas frias', '04', 'Lei 13.097/2015, art. 14', 'Ex 01 da TIPI'),
('27101259', 'Gasolina automotiva (exceto de aviacao)', 'Combustiveis', '04', 'Lei 9.718/1998, art. 4o', NULL),
('271019', 'Oleo diesel e demais derivados', 'Combustiveis', '04', 'Lei 9.718/1998, art. 4o', 'Conferir subposicao: diesel e oleos combustiveis'),
('2711', 'Gas liquefeito de petroleo (GLP) e gas natural', 'Combustiveis', '04', 'Lei 9.718/1998, art. 4o', NULL),
('220710', 'Alcool etilico nao desnaturado (hidratado combustivel)', 'Combustiveis', '04', 'Lei 9.718/1998, art. 5o', NULL),
('220720', 'Alcool etilico desnaturado (anidro combustivel)', 'Combustiveis', '04', 'Lei 9.718/1998, art. 5o', NULL);
