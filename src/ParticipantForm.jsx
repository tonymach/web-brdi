import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';

const ParticipantForm = ({ onSubmit, error }) => {
  const formRef = useRef(null);
  
  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    onSubmit({
      participantId: formData.get('participantId'),
      inputDevice: formData.get('inputDevice'),
      userType: formData.get('userType')
    });
  };

  const handleDebug = () => {
    if (formRef.current) {
      // Set input values
      const idInput = formRef.current.querySelector('#participantId');
      idInput.value = 'Anthony';

      // Set select values
      const deviceSelect = formRef.current.querySelector('select[name="inputDevice"]');
      const userSelect = formRef.current.querySelector('select[name="userType"]');
      
      // Trigger change events for the selects to update their display
      const event = new Event('change', { bubbles: true });
      
      deviceSelect.value = 'trackpad';
      deviceSelect.dispatchEvent(event);
      
      userSelect.value = 'participant';
      userSelect.dispatchEvent(event);

      // Submit the form
      formRef.current.requestSubmit();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            Participant Information
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleDebug}
              className="text-gray-400 hover:text-gray-600"
            >
              Debug
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <ExclamationTriangleIcon className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="participantId">Participant ID</Label>
              <Input
                id="participantId"
                name="participantId"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inputDevice">Input Device</Label>
              <Select name="inputDevice" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select input device" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="touchscreen">Touchscreen</SelectItem>
                  <SelectItem value="mouse">Mouse</SelectItem>
                  <SelectItem value="trackpad">Trackpad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="userType">User Type</Label>
              <Select name="userType" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select user type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="participant">Participant</SelectItem>
                  <SelectItem value="researcher">Researcher</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">Submit</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ParticipantForm;