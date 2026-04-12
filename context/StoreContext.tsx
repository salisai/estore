'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { CartItem, Order, Product, User } from "@/types";

interface StoreContextType {
  user: User | null;
  products: Product[];
  cart: CartItem[];
  orders: Order[];
  isCartOpen: boolean;
  login: (email: string, password?: string, isSignUp?: boolean) => Promise<{ error: any }>;
  logout: () => Promise<void>;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  addProduct: (product: Omit<Product, "id">) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  placeOrder: (stripeSessionId?: string) => Promise<void>;
  uploadImage: (file: File) => Promise<string>;
  refreshProducts: () => Promise<void>;
  refreshOrders: () => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);
const supabase = supabaseBrowser;

const API_BASE_HEADERS = {
  "Content-Type": "application/json"
};

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const getAccessToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load products");
      const payload = await res.json();
      setProducts(Array.isArray(payload.products) ? payload.products : []);
    } catch (error) {
      console.error("load products error", error);
    }
  }, []);

  const fetchOrders = useCallback(
    async (token?: string | null) => {
      if (!token) return;
      try {
        const res = await fetch("/api/orders", {
          headers: {
            Authorization: `Bearer ${token}`
          },
          cache: "no-store"
        });

        if (!res.ok) throw new Error("Failed to load orders");
        const payload = await res.json();
        setOrders(Array.isArray(payload.orders) ? payload.orders : []);
      } catch (error) {
        console.error("load orders error", error);
      }
    },
    []
  );

  const hydrateUser = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session?.user) {
      setUser(null);
      setOrders([]);
      return;
    }

    const token = session.access_token;
    let isAdmin = false;

    try {
      const res = await fetch("/api/admin/profile", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const payload = await res.json();
        isAdmin = Boolean(payload.isAdmin);
      }
    } catch (error) {
      console.error("admin profile error", error);
    }

    setUser({
      id: session.user.id,
      email: session.user.email || "",
      name: session.user.user_metadata?.name || session.user.email || "Guest",
      isAdmin
    });

    fetchOrders(token);
  }, [fetchOrders]);

  useEffect(() => {
    fetchProducts();
    hydrateUser();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setOrders([]);
        return;
      }
      hydrateUser();
    });

    const savedCart = localStorage.getItem("lumiere_cart");
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProducts, hydrateUser]);

  useEffect(() => {
    localStorage.setItem("lumiere_cart", JSON.stringify(cart));
  }, [cart]);


  const login = async (email: string, password?: string, isSignUp?: boolean) => {
    if (!password) {
      return { error: { message: "Password required" } };
    }

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      await hydrateUser();
      return { error };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    await hydrateUser();
    return { error };
  };

  
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setOrders([]);
    setCart([]);
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.id === productId ? { ...item, quantity } : item))
    );
  };

  const clearCart = () => setCart([]);
  const toggleCart = () => setIsCartOpen((prev) => !prev);

  const addProduct = async (product: Omit<Product, "id">) => {
    const token = await getAccessToken();
    if (!token) throw new Error("Unauthorized");

    const res = await fetch("/api/products", {
      method: "POST",
      headers: {
        ...API_BASE_HEADERS,
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(product)
    });

    if (!res.ok) {
      throw new Error("Failed to add product");
    }

    const payload = await res.json();
    if (payload.product) {
      setProducts((prev) => [...prev, payload.product]);
    }
  };

  const deleteProduct = async (id: string) => {
    const token = await getAccessToken();
    if (!token) throw new Error("Unauthorized");

    const res = await fetch(`/api/products/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error("Failed to delete product");
    }

    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const placeOrder = async (stripeSessionId?: string) => {
    const token = await getAccessToken();
    if (!token) throw new Error("Unauthorized");

    const total = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const serializableItems = cart.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      category: item.category,
      description: item.description,
      image: typeof item.image === "string" ? item.image : null,
      stock: item.stock
    }));

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: {
        ...API_BASE_HEADERS,
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        items: serializableItems,
        total,
        stripeSessionId
      })
    });

    if (!res.ok) {
      throw new Error("Failed to place order");
    }

    const payload = await res.json();
    if (payload.order) {
      setOrders((prev) => [payload.order, ...prev]);
      clearCart();
    }
  };

  const uploadImage = async (file: File) => {
    const token = await getAccessToken();
    if (!token) throw new Error("Unauthorized");

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    if (!res.ok) {
      throw new Error("Image upload failed");
    }

    const payload = await res.json();
    return payload.url as string;
  };

  const value: StoreContextType = {
    user,
    products,
    cart,
    orders,
    isCartOpen,
    login,
    logout,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    toggleCart,
    addProduct,
    deleteProduct,
    placeOrder,
    uploadImage,
    refreshProducts: fetchProducts,
    refreshOrders: async () => {
      const token = await getAccessToken();
      await fetchOrders(token);
    }
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
};