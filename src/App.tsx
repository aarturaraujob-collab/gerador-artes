import { Route, Switch } from "wouter";

import { Templates } from "@/pages/templates/Templates";
import { TemplateCollection } from "@/pages/templates/TemplateCollection";
import NotFound from "@/pages/NotFound";

export default function App() {
  return (
    <Switch>
      <Route path="/" component={Templates} />
      <Route path="/templates" component={Templates} />
      <Route path="/templates/:folder" component={TemplateCollection} />
      <Route component={NotFound} />
    </Switch>
  );
}
