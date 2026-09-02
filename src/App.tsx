import { useEffect, useRef, useState, type ReactNode } from "react";
import { Route, Router, Switch } from "wouter";

import { Spinner } from "@/components/ui/spinner";
import { useAuthSession } from "@/hooks/useAuthSession";
import { LoginPage } from "@/pages/auth/LoginPage";
import { WelcomeSplash } from "@/pages/auth/WelcomeSplash";
import { consumeJustSignedIn } from "@/modules/auth";
import { Home } from "@/pages/dashboard/Home";

import { Templates } from "@/pages/templates/Templates";
import { TemplateCollection } from "@/pages/templates/TemplateCollection";

import { CompetitionsPage } from "@/pages/settings/CompetitionsPage";
import { CompetitionWizard } from "@/pages/settings/CompetitionWizard";
import { CompetitionHub } from "@/pages/settings/CompetitionHub";
import { ClubsPage } from "@/pages/settings/ClubsPage";
import { ClubForm } from "@/pages/settings/ClubForm";
import { StadiumsPage } from "@/pages/settings/StadiumsPage";
import { StadiumForm } from "@/pages/settings/StadiumForm";
import { CitiesPage } from "@/pages/settings/CitiesPage";
import { CityForm } from "@/pages/settings/CityForm";
import { OperationalStaffPage } from "@/pages/settings/OperationalStaffPage";
import { OperationalStaffForm } from "@/pages/settings/OperationalStaffForm";
import { MatchPage } from "@/pages/matches/MatchPage";
import { EscalaOficiaisPage } from "@/pages/settings/EscalaOficiaisPage";
import { FaftvHomePage } from "@/pages/settings/FaftvHomePage";
import { FaftvOperacoesPage } from "@/pages/settings/FaftvOperacoesPage";
import { FaftvPagamentosPage } from "@/pages/settings/FaftvPagamentosPage";
import { FafLabDashboard } from "@/pages/faflab/FafLabDashboard";
import { AssetsPage } from "@/pages/settings/AssetsPage";
import { ConfiguracoesPage } from "@/pages/settings/ConfiguracoesPage";
import { TrashPage } from "@/pages/settings/TrashPage";
import { HistoryPage } from "@/pages/settings/HistoryPage";

import NotFound from "@/pages/NotFound";

/** Gate everything behind a Supabase Auth session (Fase 1 da migração — contas individuais). */
function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuthSession();
  const [welcoming, setWelcoming] = useState(false);
  const announced = useRef(false);

  useEffect(() => {
    if (session && !announced.current && consumeJustSignedIn()) {
      announced.current = true;
      setWelcoming(true);
      setTimeout(() => setWelcoming(false), 1000);
    }
  }, [session]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!session) return <LoginPage />;

  return (
    <>
      <WelcomeSplash show={welcoming} />
      {children}
    </>
  );
}

export default function App() {
  const routerBase = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

  return (
    <Router base={routerBase}>
      <Switch>
        {/* Public FAF Lab — no login required. Reuses FafLabDashboard in
            read-only mode, backed by usePublicFafLabData (never touches the
            authenticated-only dataStore, which also loads staff PII). */}
        <Route path="/publico/faf-lab" component={() => <FafLabDashboard publicMode />} />
        <Route path="/publico/faf-lab/:competitionId" component={() => <FafLabDashboard publicMode />} />

        <Route>
          <RequireAuth>
            <Switch>
            {/* Dashboard */}
            <Route path="/" component={Home} />

        {/* Artes */}
        <Route path="/artes" component={Templates} />
        <Route path="/artes/:folder" component={TemplateCollection} />
        <Route path="/templates" component={Templates} />
        <Route path="/templates/:folder" component={TemplateCollection} />

        {/* FAF Lab */}
        <Route path="/faf-lab" component={() => <FafLabDashboard />} />
        <Route path="/faf-lab/:competitionId" component={() => <FafLabDashboard />} />

        {/* Cadastros */}
        <Route path="/cadastros/competicoes" component={CompetitionsPage} />

        <Route path="/cadastros/competicoes/nova" component={CompetitionWizard} />

        <Route path="/cadastros/competicoes/:id/editar" component={CompetitionWizard} />

        <Route path="/cadastros/competicoes/:id" component={CompetitionHub} />

        <Route path="/cadastros/competicoes/:competitionId/jogos/:matchParam" component={MatchPage} />

        <Route path="/cadastros/competicoes/:id/escala-oficiais" component={EscalaOficiaisPage} />

        <Route path="/cadastros/clubes" component={ClubsPage} />
        <Route path="/cadastros/clubes/novo" component={ClubForm} />
        <Route path="/cadastros/clubes/:id/editar" component={ClubForm} />

        <Route path="/cadastros/estadios" component={StadiumsPage} />
        <Route path="/cadastros/estadios/novo" component={StadiumForm} />
        <Route path="/cadastros/estadios/:id/editar" component={StadiumForm} />

        <Route path="/cadastros/cidades" component={CitiesPage} />
        <Route path="/cadastros/cidades/novo" component={CityForm} />
        <Route path="/cadastros/cidades/:id/editar" component={CityForm} />

        <Route path="/cadastros/faftv/operacoes" component={FaftvOperacoesPage} />
        <Route path="/cadastros/faftv/pagamentos" component={FaftvPagamentosPage} />
        <Route path="/cadastros/faftv/equipe" component={() => <OperationalStaffPage area="FAFTV" />} />
        <Route path="/cadastros/faftv/equipe/novo" component={() => <OperationalStaffForm area="FAFTV" />} />
        <Route path="/cadastros/faftv/equipe/:id/editar" component={() => <OperationalStaffForm area="FAFTV" />} />
        <Route path="/cadastros/faftv" component={FaftvHomePage} />

        <Route path="/cadastros/oficiais-dco" component={() => <OperationalStaffPage area="DCO" />} />
        <Route path="/cadastros/oficiais-dco/novo" component={() => <OperationalStaffForm area="DCO" />} />
        <Route path="/cadastros/oficiais-dco/:id/editar" component={() => <OperationalStaffForm area="DCO" />} />

        <Route path="/cadastros/arbitros" component={() => <OperationalStaffPage area="Arbitragem" />} />
        <Route path="/cadastros/arbitros/novo" component={() => <OperationalStaffForm area="Arbitragem" />} />
        <Route path="/cadastros/arbitros/:id/editar" component={() => <OperationalStaffForm area="Arbitragem" />} />

        {/* Not "/assets" — that collides with the public/assets/ static folder deployed to the same path (Apache serves the real directory instead of falling through to index.html, returning 403). */}
        <Route path="/biblioteca-assets" component={AssetsPage} />
        <Route path="/configuracoes" component={ConfiguracoesPage} />
        <Route path="/lixeira" component={TrashPage} />
        <Route path="/historico" component={HistoryPage} />

            <Route component={NotFound} />
            </Switch>
          </RequireAuth>
        </Route>
      </Switch>
    </Router>
  );
}
