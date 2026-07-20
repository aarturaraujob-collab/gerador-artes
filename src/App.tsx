import { Route, Switch } from "wouter";

import { Templates } from "@/pages/templates/Templates";
import { TemplateCollection } from "@/pages/templates/TemplateCollection";
import NotFound from "@/pages/NotFound";

// New imports for the generator UI (we add a new route /generator)
import GeneratorPage from "./pages/generator/GeneratorPage";

export default function App() {
  return (
    <Switch>
      <Route path="/" component={Templates} />
      <Route path="/templates" component={Templates} />
      <Route path="/templates/:folder" component={TemplateCollection} />
      <Route path="/generator" component={GeneratorPage} />
      <Route component={NotFound} />
    </Switch>
  );
}
