'use client';

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Trash2, Mail, MessageSquare, Eye } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, Tooltip, CartesianGrid, XAxis } from "recharts";
import { useStore } from "@/context/StoreContext";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ProductCategory, type Product } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"


type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "unread" | "read" | "replied";
  created_at: string;
};

const AdminPage = () => {
  const router = useRouter();
  const { user, products, orders, addProduct, deleteProduct, uploadImage, refreshOrders } = useStore();
  const [isSaving, setIsSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "catalog" | "orders" | "messages">("overview");
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [newProduct, setNewProduct] = useState<Omit<Product, "id">>({
    name: "",
    price: 0,
    category: ProductCategory.RINGS,
    description: "",
    image: null,
    stock: 0
  });
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);


  useEffect(() => {
    if (user && !user.isAdmin) {
      router.replace("/");
    }
  }, [user, router]);

  const fetchMessages = async () => {
    setIsLoadingMessages(true);
    const { data, error } = await supabaseBrowser
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setMessages(data);
    }
    setIsLoadingMessages(false);
  };

  useEffect(() => {
    if (activeTab === "messages") {
      fetchMessages();
    }
    if (activeTab === "orders") {
      void refreshOrders();
    }
  }, [activeTab, refreshOrders]);

  const markAsRead = async (id: string) => {
    const { error } = await supabaseBrowser
      .from('contact_messages')
      .update({ status: 'read' })
      .eq('id', id);
    if (!error) {
      setMessages(messages.map(m => m.id === id ? { ...m, status: 'read' } : m));
    }
  };

  const deleteMessage = async (id: string) => {
    const { error } = await supabaseBrowser
      .from('contact_messages')
      .delete()
      .eq('id', id);
    if (!error) {
      setMessages(messages.filter(m => m.id !== id));
    }
  };

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <p className="text-lg">Please sign in as an administrator to view the dashboard.</p>
        <Button onClick={() => router.push("/auth")}>Go to Auth</Button>
      </div>
    );
  }

  if (!user.isAdmin) {
    return null;
  }

  const paidLike = (s: string) => s === "paid" || s === "shipped" || s === "delivered";
  const revenue = orders.filter((o) => paidLike(o.status)).reduce((acc, order) => acc + Number(order.total), 0);
  const pendingOrders = orders.filter((order) => order.status === "pending").length;
  const topProducts = [...products]
    .sort((a, b) => b.stock - a.stock)
    .slice(0, 5);

  const salesTrend = useMemo(() => {
    const map = new Map<string, number>();
    orders
      .filter((order) => paidLike(order.status))
      .forEach((order) => {
        const date = new Date(order.date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
        map.set(date, (map.get(date) || 0) + Number(order.total));
      });
    return Array.from(map.entries()).map(([name, total]) => ({ name, total }));
  }, [orders]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert("Please upload a product image");
      return;
    }

    setIsSaving(true);
    try {
      const imageUrl = await uploadImage(file);
      await addProduct({ ...newProduct, image: imageUrl });
      setNewProduct({
        name: "",
        price: 0,
        category: ProductCategory.RINGS,
        description: "",
        image: null,
        stock: 0
      });
      setFile(null);
    } catch (error) {
      console.error(error);
      alert("Failed to add product");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Control center</p>
          <h1 className="text-3xl font-serif">Admin Dashboard</h1>
        </div>
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardDescription>Revenue</CardDescription>
                <CardTitle>${revenue.toFixed(2)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">
                  Only paid, shipped, or delivered (pending checkout excluded). {orders.length} order row{orders.length === 1 ? "" : "s"} in Supabase.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Active SKUs</CardDescription>
                <CardTitle>{products.length}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500">Maintained in Supabase</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Pending Orders</CardDescription>
                <CardTitle>{pendingOrders}</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={(pendingOrders / Math.max(1, orders.length)) * 100} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sales trend</CardTitle>
              <CardDescription>Seven day revenue view</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {salesTrend.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500">No sales data yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesTrend}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0a0a0a" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#0a0a0a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <Tooltip />
                    <Area type="monotone" dataKey="total" stroke="#0a0a0a" fillOpacity={1} fill="url(#colorTotal)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Inventory</CardTitle>
              <CardDescription>Fast moving products by stock</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.stock}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{product.category}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "catalog" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:sticky lg:top-24 h-fit">
            <CardHeader>
              <CardTitle>Add product</CardTitle>
              <CardDescription>Upload assets, pricing and inventory.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleAddProduct}>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price</Label>
                    <Input
                      id="price"
                      type="number"
                      value={newProduct.price || ""}
                      onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock">Stock</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={newProduct.stock || ""}
                      onChange={(e) => setNewProduct({ ...newProduct, stock: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    className="w-full border border-gray-300 p-2 text-sm"
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value as ProductCategory })}
                  >
                    {Object.values(ProductCategory).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Product image</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const chosen = e.target.files?.[0];
                      if (chosen) setFile(chosen);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSaving}>
                  {isSaving ? "Saving..." : "Add Product"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Catalog</CardTitle>
              <CardDescription>Products synced with Supabase</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative h-12 w-12">
                            <Image src={product.image as string} alt={product.name} width={48} height={48} className="object-cover" />
                          </div>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-xs text-gray-500">{product.category}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>${product.price}</TableCell>
                      <TableCell>{product.stock}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => deleteProduct(product.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "orders" && (
        <Card>
          <CardHeader>
            <CardTitle>Orders</CardTitle>
            <CardDescription>
              Rows come from Supabase <code className="text-xs">orders</code>. Pending = checkout started; paid = Stripe webhook (
              <code className="text-xs">checkout.session.completed</code>) confirmed payment.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">No orders yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Lines</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Stripe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const lines = Array.isArray(order.items) ? order.items.length : 0;
                    const stripeId = order.stripeSessionId;
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="text-sm whitespace-nowrap">
                          {new Date(order.date).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-gray-600 max-w-[140px] truncate" title={order.userId}>
                          {order.userId}
                        </TableCell>
                        <TableCell>{lines}</TableCell>
                        <TableCell>${Number(order.total).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              order.status === "paid" || order.status === "shipped" || order.status === "delivered"
                                ? "default"
                                : order.status === "pending"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-[10px] text-gray-500 max-w-[160px] truncate" title={stripeId || ""}>
                          {stripeId || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Messages Tab */}
      {activeTab === "messages" && (
        <Card>
          <CardHeader>
            <CardTitle>Customer Messages</CardTitle>
            <CardDescription>Direct inquiries from the contact form</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingMessages ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      <div className="flex items-center justify-center gap-2 text-gray-400">
                        {/* <Loader2 className="animate-spin" size={16} /> */}
                        Loading messages...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : messages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                      No messages received yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  messages.map((msg) => (
                    <TableRow key={msg.id} className={msg.status === 'unread' ? 'bg-neutral-50/50' : ''}>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-medium text-sm">{msg.name}</p>
                          <p className="text-xs text-gray-500">{msg.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate text-sm" title={msg.message}>
                          {msg.subject}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedMessage(msg)}
                          title="View message"
                        >
                          <Eye size={16} />
                        </Button>

                        
                      </TableCell>

                      <TableCell className="text-sm">
                        {new Date(msg.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={msg.status === 'unread' ? 'secondary' : 'outline'}>
                          {msg.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {msg.status === 'unread' && (
                            <Button size="sm" variant="ghost" onClick={() => markAsRead(msg.id)} title="Mark as read">
                              <Eye size={16} className="text-gray-400" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => deleteMessage(msg.id)} className="text-red-500 hover:text-red-600">
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Message Dialog – rendered once */}
            {selectedMessage && (
            <Dialog open={true} onOpenChange={() => setSelectedMessage(null)}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{selectedMessage.subject}</DialogTitle>
                  <DialogDescription>
                    From {selectedMessage.name} ({selectedMessage.email})
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">
                  {selectedMessage.message}
                </div>

                <div className="mt-4 text-xs text-gray-400">
                  Received on {new Date(selectedMessage.created_at).toLocaleString()}
                </div>
              </DialogContent>
            </Dialog>
          )}

          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminPage;

