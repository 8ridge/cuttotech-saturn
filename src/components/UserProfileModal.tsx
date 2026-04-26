import { useState, useEffect } from 'react';
import { User, LinkIcon, Copy, Check, MousePointerClick, BarChart2, BarChart3 } from './icons';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Card, CardContent } from './ui/card';
import { toast } from 'sonner';

interface UserProfileModalProps {
  user: any;
  selectedUser: {
    userId?: string;
    clientUuid?: string;
    userEmail?: string;
    userName?: string;
    creatorIp?: string;
  };
  onClose: () => void;
  onViewStats: (shortCode: string) => void;
}

interface UserLink {
  shortCode: string;
  originalUrl: string;
  createdAt: string;
  customDomain?: string | null;
  clicks?: number;
}

export default function UserProfileModal({
  user,
  selectedUser,
  onClose,
  onViewStats,
}: UserProfileModalProps) {
  const [userLinks, setUserLinks] = useState<UserLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalLinks: 0,
    totalClicks: 0,
    limitUsage: null as { used: number; max: number } | null,
  });

  useEffect(() => {
    if (selectedUser && user?.access_token) {
      loadUserLinks();
    }
  }, [selectedUser, user]);

  const loadUserLinks = async () => {
    if (!user?.access_token) {
      return;
    }

    setLoading(true);
    try {
      const { getApiUrl } = await import('../utils/api/config');
      let apiUrl;
      
      if (selectedUser.userId) {
        // Registered user - filter by userId
        apiUrl = getApiUrl(`admin/urls?userId=${selectedUser.userId}`);
      } else if (selectedUser.clientUuid) {
        // Anonymous user - filter by clientUuid
        apiUrl = getApiUrl(`admin/urls?clientUuid=${selectedUser.clientUuid}`);
      } else {
        // No valid identifier - this shouldn't happen if frontend logic is correct
        toast.error('Invalid user identifier: No userId or clientUuid provided');
        setLoading(false);
        return;
      }

      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Bearer ${user.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('Unauthorized - Admin access required');
        } else {
          const result = await response.json().catch(() => ({}));
          toast.error(result.error || 'Failed to load user links');
        }
        setLoading(false);
        return;
      }

      const result = await response.json();
      const links = result.urls || [];
      
      setUserLinks(links);
      
      // Calculate stats
      const totalLinks = links.length;
      const totalClicks = links.reduce((sum: number, link: UserLink) => sum + (link.clicks || 0), 0);
      
      // Get limit usage for anonymous users
      let limitUsage = null;
      if (!selectedUser.userId && links.length > 0) {
        const firstLink = links[0] as any;
        if (firstLink.limitUsage) {
          limitUsage = firstLink.limitUsage;
        }
      }
      
      setStats({ totalLinks, totalClicks, limitUsage });
    } catch (error) {
      console.error('Load user links error:', error);
      toast.error('Failed to load user links');
    } finally {
      setLoading(false);
    }
  };

  const isRegistered = !!selectedUser.userId;
  const isAnonymous = !!selectedUser.clientUuid;
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy to clipboard');
    }
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (isRegistered && selectedUser.userName) {
      const names = selectedUser.userName.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
      }
      return selectedUser.userName.substring(0, 2).toUpperCase();
    }
    if (isRegistered && selectedUser.userEmail) {
      return selectedUser.userEmail.substring(0, 2).toUpperCase();
    }
    return 'AN';
  };

  return (
    <Dialog open={!!selectedUser} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="bg-background border shadow-lg sm:rounded-lg"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '80vh',
          maxHeight: '80vh',
          maxWidth: '1000px',
          width: '90vw',
          overflow: 'hidden',
          padding: 0
        }}
      >
        {/* Fixed Header Section */}
        <div 
          className="border-b"
          style={{
            flex: '0 0 auto',
            padding: '24px',
            borderBottom: '1px solid hsl(var(--border))'
          }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User size={20} />
              {isRegistered ? 'Registered User Profile' : 'Anonymous User Profile'}
            </DialogTitle>
            <DialogDescription>
              {isRegistered
                ? `Viewing all links created by ${selectedUser.userEmail || selectedUser.userName || 'this user'}`
                : `Viewing all links created by this anonymous user`}
            </DialogDescription>
          </DialogHeader>

          {/* User Identity */}
          <div className="bg-muted/30 dark:bg-slate-900/50 rounded-lg p-6">
            {isRegistered ? (
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold flex-shrink-0">
                  {getUserInitials()}
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="text-xl font-bold">{selectedUser.userName || selectedUser.userEmail || 'User'}</p>
                    <p className="text-sm text-muted-foreground mt-1">{selectedUser.userEmail || 'N/A'}</p>
                  </div>
                  {selectedUser.userId && (
                    <div className="font-mono text-xs bg-muted px-2 py-1 rounded border inline-block">
                      ID: {selectedUser.userId}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl font-bold flex-shrink-0">
                  AN
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-xl font-bold">Anonymous User</p>
                    <p className="text-sm text-muted-foreground mt-1">Guest visitor</p>
                  </div>
                  <div className="space-y-2">
                    {selectedUser.clientUuid && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Client UUID</label>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-muted px-2 py-1 rounded border flex-1 break-all">
                            {selectedUser.clientUuid}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopy(selectedUser.clientUuid!, 'clientUuid')}
                            className="h-8 w-8 p-0 flex-shrink-0"
                            title="Copy Client UUID"
                          >
                            {copiedField === 'clientUuid' ? (
                              <Check size={14} className="text-green-600" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                    {selectedUser.creatorIp && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">IP Address</label>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-muted px-2 py-1 rounded border flex-1">
                            {selectedUser.creatorIp}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopy(selectedUser.creatorIp!, 'ip')}
                            className="h-8 w-8 p-0 flex-shrink-0"
                            title="Copy IP Address"
                          >
                            {copiedField === 'ip' ? (
                              <Check size={14} className="text-green-600" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <Card className="h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">{stats.totalLinks}</div>
                    <div className="text-sm text-muted-foreground mt-1">Total Links</div>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <LinkIcon size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="h-full">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">{stats.totalClicks}</div>
                    <div className="text-sm text-muted-foreground mt-1">Total Clicks</div>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <MousePointerClick size={20} className="text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            {isAnonymous && stats.limitUsage ? (
              <Card className="h-full">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-2xl font-bold">
                        {stats.limitUsage.used}/{stats.limitUsage.max}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">Free Links Used</div>
                      <div className="mt-3">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              stats.limitUsage.used >= stats.limitUsage.max
                                ? 'bg-red-500'
                                : stats.limitUsage.used >= stats.limitUsage.max - 1
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                            }`}
                            style={{
                              width: `${(stats.limitUsage.used / stats.limitUsage.max) * 100}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {stats.limitUsage.max - stats.limitUsage.used} links remaining
                        </p>
                      </div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <BarChart2 size={20} className="text-orange-600 dark:text-orange-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="h-full">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold">
                        {stats.totalLinks > 0 
                          ? (stats.totalClicks / stats.totalLinks).toFixed(1)
                          : '0.0'}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">Avg. Clicks / Link</div>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <BarChart3 size={20} className="text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Scrollable Body Section */}
        <div 
          className="[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-2 [&::-webkit-scrollbar-thumb]:border-transparent hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30"
          style={{
            flex: '1 1 auto',
            overflowY: 'auto',
            padding: '24px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
          }}
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <LinkIcon size={18} />
            User's Links ({userLinks.length})
          </h3>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading links...</div>
          ) : userLinks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No links found for this user</p>
            </div>
          ) : (
            <div className="overflow-x-hidden">
              <Table 
                className="w-full"
                style={{ tableLayout: 'fixed', width: '100%' }}
              >
                <TableHeader className="sticky top-0 bg-white dark:bg-slate-950 z-20 border-b">
                  <TableRow>
                    <TableHead style={{ width: '140px' }}>Short Link</TableHead>
                    <TableHead>Original URL</TableHead>
                    <TableHead style={{ width: '160px' }}>Created At</TableHead>
                    <TableHead style={{ width: '80px' }} className="text-center">Clicks</TableHead>
                    <TableHead style={{ width: '100px' }} className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userLinks.map((link) => (
                    <TableRow key={link.shortCode} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-mono text-sm" style={{ width: '140px' }}>
                        <div className="truncate" title={link.customDomain ? `${link.customDomain}/${link.shortCode}` : `/${link.shortCode}`}>
                          {link.customDomain
                            ? `${link.customDomain}/${link.shortCode}`
                            : `/${link.shortCode}`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <a
                          href={link.originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
                          title={link.originalUrl}
                          style={{
                            display: 'block',
                            maxWidth: '100%',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {link.originalUrl}
                        </a>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" style={{ width: '160px' }}>
                        {new Date(link.createdAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </TableCell>
                      <TableCell className="text-center" style={{ width: '80px' }}>
                        {link.clicks || 0}
                      </TableCell>
                      <TableCell className="text-right" style={{ width: '100px' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onViewStats(link.shortCode);
                            onClose();
                          }}
                          className="h-8 w-8 p-0"
                          title="View Stats"
                        >
                          <BarChart2 size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

