import { Route, Switch } from "wouter";

import { Templates } from "@/pages/templates/Templates";
import { TemplateCollection } from "@/pages/templates/TemplateCollection";
import { CompetitionsPage } from "@/pages/settings/CompetitionsPage";
import { CompetitionWizard } from "@/pages/settings/CompetitionWizard";
import NotFound from "@/pages/NotFound";

export default function App() {
  return (
    <Switch>
      <Route path="/" component={Templates} />
      <Route path="/templates" component={Templates} />
      <Route path="/templates/:folder" component={TemplateCollection} />
      <Route path="/cadastros/competicoes" component={CompetitionsPage} />
      <Route path="/cadastros/competicoes/nova" component={CompetitionWizard} />
      <Route path="/cadastros/competicoes/:id/editar" component={CompetitionWizard} />
      <Route component={NotFound} />
    </Switch>
  );
}
