import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiAuth } from '@/hooks/useApiAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plane, Users, CheckCircle } from 'lucide-react';

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const { signIn, signUp, user } = useApiAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Redirect authenticated users away from auth page
  React.useEffect(() => {
    if (user) {
      console.log('✅ User is already authenticated, redirecting to dashboard');
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('=== LOGIN ATTEMPT START ===');
    console.log('Email:', email);
    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);
      console.log('=== LOGIN RESPONSE ===');
      console.log('Error:', error);

      if (error) {
        console.log('=== LOGIN FAILED ===');
        toast({
          title: "Authentication Error",
          description: error,
          variant: "destructive",
        });
      } else {
        console.log('=== LOGIN SUCCESS ===');
        console.log('🔄 Navigating to dashboard after successful login');
        
        // For Vercel deployments, use window.location instead of navigate to prevent loops
        if (window.location.hostname.includes('vercel.app')) {
          window.location.href = '/';
        } else {
          navigate('/', { replace: true });
        }
      }
    } catch (err) {
      console.error('=== LOGIN EXCEPTION ===', err);
      toast({
        title: "Authentication Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }

    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error, message } = await signUp(email, password, fullName);

    if (error) {
      toast({
        title: "Registration Error",
        description: error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Registration Successful",
        description: message || "Please check your email to verify your account.",
      });
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-accent to-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-white/10 backdrop-blur-sm p-3 rounded-full">
              <Plane className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Purple Cow</h1>
          <p className="text-white/80">Enterprise Project Management</p>
        </div>

        <Card className="backdrop-blur-sm bg-white/95 border-white/20 shadow-airbus">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-foreground">Welcome</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="border-border/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="border-border/50"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    variant="primary" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>
              
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="border-border/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="border-border/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="border-border/50"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    variant="primary" 
                    className="w-full" 
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="mt-6 pt-6 border-t border-border/20">
              <div className="text-sm text-muted-foreground text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>New users get Project Coordinator role</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  <span>admin@admin.com has Administrator access</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;