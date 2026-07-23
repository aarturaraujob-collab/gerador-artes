import { Route, Switch } from "wouter";

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
import { OperationalStaffPage } from "@/pages/settings/OperationalStaffPage";
import { OperationalStaffForm } from "@/pages/settings/OperationalStaffForm";
import { MatchPage } from "@/pages/matches/MatchPage";
import { AssetsPage } from "@/pages/settings/AssetsPage";
import { ConfiguracoesPage } from "@/pages/settings/ConfiguracoesPage";
import { TrashPage } from "@/pages/settings/TrashPage";
import { HistoryPage } from "@/pages/settings/HistoryPage";

import NotFound from "@/pages/NotFound";

export default function App() {
  return (
    <Switch>

      {/* Dashboard */}
      <Route path="/" component={Home} />

      {/* Artes */}
      <Route path="/artes" component={Templates} />
      <Route path="/artes/:folder" component={TemplateCollection} />

      {/* Compatibilidade temporária */}
      <Route path="/templates" component={Templates} />
      <Route path="/templates/:folder" component={TemplateCollection} />

      {/* Cadastros */}
      <Route
        path="/cadastros/competicoes"
        component={CompetitionsPage}
      />

      <Route
        path="/cadastros/competicoes/nova"
        component={CompetitionWizard}
      />

      <Route
        path="/cadastros/competicoes/:id/editar"
        component={CompetitionWizard}
      />

      <Route path="/cadastros/competicoes/:id" component={CompetitionHub} />

      <Route
        path="/cadastros/competicoes/:competitionId/jogos/:matchParam"
        component={MatchPage}
      />

      <Route path="/cadastros/clubes" component={ClubsPage} />
      <Route path="/cadastros/clubes/novo" component={ClubForm} />
      <Route path="/cadastros/clubes/:id/editar" component={ClubForm} />

      <Route path="/cadastros/estadios" component={StadiumsPage} />
      <Route path="/cadastros/estadios/novo" component={StadiumForm} />
      <Route path="/cadastros/estadios/:id/editar" component={StadiumForm} />

      <Route path="/cadastros/faftv" component={() => <OperationalStaffPage area="FAFTV" />} />
      <Route path="/cadastros/faftv/novo" component={() => <OperationalStaffForm area="FAFTV" />} />
      <Route path="/cadastros/faftv/:id/editar" component={() => <OperationalStaffForm area="FAFTV" />} />

      <Route path="/cadastros/oficiais-dco" component={() => <OperationalStaffPage area="DCO" />} />
      <Route path="/cadastros/oficiais-dco/novo" component={() => <OperationalStaffForm area="DCO" />} />
      <Route path="/cadastros/oficiais-dco/:id/editar" component={() => <OperationalStaffForm area="DCO" />} />

      <Route path="/assets" component={AssetsPage} />
      <Route path="/configuracoes" component={ConfiguracoesPage} />
      <Route path="/lixeira" component={TrashPage} />
      <Route path="/historico" component={HistoryPage} />

      <Route component={NotFound} />
    </Switch>
  );
}