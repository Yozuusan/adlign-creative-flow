import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Team = () => {
  const [members, setMembers] = useState([
    { email: "owner@example.com", role: "owner" },
  ]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");

  const invite = () => {
    if (!email) return;
    setMembers((m) => [{ email, role }, ...m]);
    setEmail("");
  };

  return (
    <div className="space-y-6">
      <Helmet>
        <title>Team — Adlign</title>
        <meta name="description" content="Invite teammates and manage access." />
        <link rel="canonical" href="/app/team" />
      </Helmet>

      <Card>
        <CardHeader>
          <CardTitle>Invite teammate</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input placeholder="email@example.com" value={email} onChange={(e)=>setEmail(e.target.value)} />
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={invite}>Invite</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Members</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {members.map((m)=> (
              <li key={m.email} className="flex items-center justify-between">
                <span>{m.email}</span>
                <span className="text-muted-foreground capitalize">{m.role}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default Team;
