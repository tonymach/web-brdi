import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Copy } from 'lucide-react';

export default function URLGenerator() {
  const [conditions, setConditions] = useState({
    regular: true,
    mirror: false,
    decoupled: false,
    decoupledMirror: false
  });
  const [trials, setTrials] = useState(20);
  const [baseUrl, setBaseUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const generateURL = () => {
    const selectedConditions = Object.entries(conditions)
      .filter(([_, isSelected]) => isSelected)
      .map(([condition]) => condition);

    const params = new URLSearchParams();
    params.set('trials', trials.toString());
    params.set('conditions', selectedConditions.join(','));

    return `${baseUrl}?${params.toString()}`;
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-[500px]">
        <CardHeader>
          <CardTitle>URL Generator for Cognitive Motor Task</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <Label>Base URL</Label>
              <Input
                type="text"
                placeholder="Enter your base URL (e.g., https://your-site.com/web-brdi)"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Number of Trials</Label>
              <Input
                type="number"
                min="1"
                value={trials}
                onChange={(e) => setTrials(parseInt(e.target.value))}
                className="mt-1"
              />
            </div>

            <div className="space-y-4">
              <Label>Conditions</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="regular"
                    checked={conditions.regular}
                    onCheckedChange={(checked) => 
                      setConditions(prev => ({ ...prev, regular: checked }))}
                  />
                  <Label htmlFor="regular">Regular</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mirror"
                    checked={conditions.mirror}
                    onCheckedChange={(checked) => 
                      setConditions(prev => ({ ...prev, mirror: checked }))}
                  />
                  <Label htmlFor="mirror">Mirror</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="decoupled"
                    checked={conditions.decoupled}
                    onCheckedChange={(checked) => 
                      setConditions(prev => ({ ...prev, decoupled: checked }))}
                  />
                  <Label htmlFor="decoupled">Decoupled</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="decoupledMirror"
                    checked={conditions.decoupledMirror}
                    onCheckedChange={(checked) => 
                      setConditions(prev => ({ ...prev, decoupledMirror: checked }))}
                  />
                  <Label htmlFor="decoupledMirror">Decoupled Mirror</Label>
                </div>
              </div>
            </div>

            {Object.values(conditions).filter(Boolean).length === 0 && (
              <Alert className="mt-4">
                <AlertDescription>
                  Please select at least one condition
                </AlertDescription>
              </Alert>
            )}

            <div className="pt-4">
              <Label>Generated URL</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  readOnly
                  value={generateURL()}
                  className="font-mono text-sm"
                />
                <Button
                  onClick={() => copyToClipboard(generateURL())}
                  variant="outline"
                  size="icon"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              {copied && (
                <p className="text-sm text-green-600 mt-1">
                  Copied to clipboard!
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}