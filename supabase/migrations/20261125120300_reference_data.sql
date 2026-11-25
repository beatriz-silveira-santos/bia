-- Dados de referência confirmados pela proprietária (sem preços, estoque ou avaliações)
insert into public.store_settings (id) values (1) on conflict do nothing;

insert into public.categories (name, slug, position, description) values
  ('Perfumes', 'perfumes', 1, null),
  ('Skincare', 'skincare', 2, 'Skincare importado.'),
  ('Cabelos', 'cabelos', 3, 'Cuidados capilares.'),
  ('Kits e Presentes', 'kits-e-presentes', 4, 'Kits e combos montados com produtos da loja.')
on conflict (slug) do nothing;

insert into public.categories (name, slug, parent_id, position)
select v.name, v.slug, (select id from public.categories where slug = 'perfumes'), v.pos
from (values
  ('Perfumes femininos', 'perfumes-femininos', 1),
  ('Perfumes masculinos', 'perfumes-masculinos', 2),
  ('Perfumes infantis', 'perfumes-infantis', 3),
  ('Perfumes árabes', 'perfumes-arabes', 4),
  ('Decantes 5 ml', 'decantes-5-ml', 5)
) as v(name, slug, pos)
on conflict (slug) do nothing;

-- Marcas informadas (grafia a validar pela proprietária antes de cadastrar produtos).
-- "One Million" é linha da Rabanne, não marca: cadastrar como produto da marca Rabanne.
insert into public.brands (name, slug) values
  ('Medicube', 'medicube'),
  ('Carolina Herrera', 'carolina-herrera'),
  ('Rabanne', 'rabanne'),
  ('Britney Spears', 'britney-spears'),
  ('FINO', 'fino'),
  ('Kerasys', 'kerasys'),
  ('Lattafa', 'lattafa'),
  ('Armaf', 'armaf'),
  ('Al Wataniah', 'al-wataniah'),
  ('Al Haramain', 'al-haramain'),
  ('Afnan', 'afnan'),
  ('Rasasi', 'rasasi'),
  ('Swiss Arabian', 'swiss-arabian'),
  ('Kayali', 'kayali'),
  ('Orientica', 'orientica'),
  ('Maison Alhambra', 'maison-alhambra'),
  ('Ajmal', 'ajmal')
on conflict (slug) do nothing;

-- Feriados nacionais (editar/acrescentar municipais e estaduais no painel)
insert into public.holidays (day, name) values
  ('2026-01-01','Confraternização Universal'), ('2026-04-03','Sexta-feira Santa'),
  ('2026-04-21','Tiradentes'), ('2026-05-01','Dia do Trabalho'), ('2026-09-07','Independência do Brasil'),
  ('2026-10-12','Nossa Senhora Aparecida'), ('2026-11-02','Finados'), ('2026-11-15','Proclamação da República'),
  ('2026-11-20','Dia Nacional de Zumbi e da Consciência Negra'), ('2026-12-25','Natal'),
  ('2027-01-01','Confraternização Universal'), ('2027-03-26','Sexta-feira Santa'),
  ('2027-04-21','Tiradentes'), ('2027-05-01','Dia do Trabalho'), ('2027-09-07','Independência do Brasil'),
  ('2027-10-12','Nossa Senhora Aparecida'), ('2027-11-02','Finados'), ('2027-11-15','Proclamação da República'),
  ('2027-11-20','Dia Nacional de Zumbi e da Consciência Negra'), ('2027-12-25','Natal')
on conflict (day) do nothing;
