import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ConnectionConfig } from "@/types/connection";
import { AdvancedTab } from "./ConnectionForm/AdvancedTab";
import { AuthTab } from "./ConnectionForm/AuthTab";
import { GeneralTab } from "./ConnectionForm/GeneralTab";
import { SSHTunnelTab } from "./ConnectionForm/SSHTunnelTab";
import { SSLTab } from "./ConnectionForm/SSLTab";

interface ConnectionFormProps {
  config: ConnectionConfig;
  onChange: (updates: Partial<ConnectionConfig>) => void;
}

export function ConnectionForm({ config, onChange }: ConnectionFormProps) {
  return (
    <Tabs defaultValue="general" className="flex flex-col h-full">
      <TabsList className="mx-3 mt-3 justify-start flex-wrap h-auto gap-1">
        <TabsTrigger value="general" className="text-xs">
          General
        </TabsTrigger>
        <TabsTrigger value="auth" className="text-xs">
          Authentication
        </TabsTrigger>
        <TabsTrigger value="ssl" className="text-xs">
          SSL/TLS
        </TabsTrigger>
        <TabsTrigger value="ssh" className="text-xs">
          SSH Tunnel
        </TabsTrigger>
        <TabsTrigger value="advanced" className="text-xs">
          Advanced
        </TabsTrigger>
      </TabsList>
      <ScrollArea className="flex-1 p-3">
        <TabsContent value="general" className="mt-0">
          <GeneralTab config={config} onChange={onChange} />
        </TabsContent>
        <TabsContent value="auth" className="mt-0">
          <AuthTab config={config} onChange={onChange} />
        </TabsContent>
        <TabsContent value="ssl" className="mt-0">
          <SSLTab config={config} onChange={onChange} />
        </TabsContent>
        <TabsContent value="ssh" className="mt-0">
          <SSHTunnelTab config={config} onChange={onChange} />
        </TabsContent>
        <TabsContent value="advanced" className="mt-0">
          <AdvancedTab config={config} onChange={onChange} />
        </TabsContent>
      </ScrollArea>
    </Tabs>
  );
}
