import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, ChevronLeft, ChevronRight,
  Heart, Menu, Minus, Plus, Search, ShoppingBag, Sparkles, UserRound, X
} from "lucide-react";
import { api, money, apiBaseUrl } from "./api.js";
import { createAuthSession } from "./auth-session.js";
import { createCartSession } from "./cart-session.js";

const authSession = createAuthSession(api);
const useAuthUser = () => useSyncExternalStore(authSession.subscribe, authSession.getSnapshot);
import brandEmblem from "./images/Ornate_Jeweled_P_Emblem-removebg-preview.png";
import brandWordmark from "./images/Prathika_Jewellers_Gold_Logo-removebg-preview.png";

const CartContext = createContext(null);
const emptyCart = [];
const useCart = () => useContext(CartContext);
const imageFallback = "https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=900&q=85";

function CartProvider({ children, ownerId }) {
  const [session] = useState(() => createCartSession(api, ownerId));
  const { items, loading, saving, error } = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [shippingSettings, setShippingSettings] = useState(null);
  useEffect(() => { session.load(); return () => session.dispose(); }, [session]);
  useEffect(() => { try { localStorage.removeItem("pj-cart"); } catch { /* Old shared bags are never assigned to an account. */ } }, []);
  useEffect(() => { api("/store-config").then((config) => setShippingSettings(config.shipping)).catch(() => setShippingSettings(null)); }, []);
  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const count = items.reduce((total, item) => total + item.quantity, 0);
  return <CartContext.Provider value={{ items, add: session.add, setQuantity: session.setQuantity, remove: session.remove, clear: session.clear, subtotal, count, shippingSettings, loading, saving, error, retry: session.load }}>{children}</CartContext.Provider>;
}

function getShippingCharge(subtotal, settings) {
  if (!settings) return null;
  return subtotal >= settings.freeShippingThreshold ? 0 : settings.flatRate;
}

function App() {
  useEffect(() => { authSession.refresh(); }, []);
  const user = useAuthUser();
  const ownerId = user?.id ?? (user === null ? null : undefined);
  return <CartProvider key={ownerId ?? (user === undefined ? "loading" : "guest")} ownerId={ownerId}><StoreShell /></CartProvider>;
}

function BrandLogo() {
  return <Link to="/" className="brand" aria-label="Prathika Jewellers home">
    <img className="brand-mark" src={brandEmblem} alt="" width="52" height="52" />
    <span className="brand-wordmark"><img src={brandWordmark} alt="Prathika Jewellers" width="734" height="357" /></span>
  </Link>;
}

function StoreShell() {
  const cart = useCart();
  const location = useLocation();
  const [categories, setCategories] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { api("/categories").then(setCategories).catch(() => setCategories([])); }, []);
  useEffect(() => { setMenuOpen(false); setSearchOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }, [location.pathname]);

  return <>
    <div className="announcement">A little something beautiful, for every day <span>✦</span> Thoughtfully selected jewellery</div>
    <header className="site-header">
      <button className="icon-btn mobile-menu" aria-label="Open menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
      <BrandLogo />
      <nav className={`main-nav ${menuOpen ? "open" : ""}`}>
        <Link to="/">Home</Link>
        <Link to="/shop">Shop all</Link>
        <div className="nav-dropdown"><Link to="/shop">Collections <ChevronDown size={13} /></Link><div className="dropdown-panel">
          {categories.map((category) => <Link key={category._id} to={`/shop?category=${category.slug}`}>{category.name}</Link>)}
          {!categories.length && <Link to="/shop">Explore all pieces</Link>}
        </div></div>
        <Link to="/shop?sort=newest">New arrivals</Link>
        <Link to="/shop?sort=popular">Bestsellers</Link>
      </nav>
      <div className="header-actions">
        <button className="icon-btn" aria-label="Search" onClick={() => setSearchOpen(true)}><Search /></button>
        <Link to="/account" className="icon-btn" aria-label="Account"><UserRound /></Link>
        <Link to="/cart" className="icon-btn cart-icon" aria-label="Shopping bag"><ShoppingBag />{useCart().count > 0 && <span>{useCart().count}</span>}</Link>
      </div>
    </header>
    <AnimatePresence>{searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}</AnimatePresence>
    {cart.error && <div className="cart-status form-error" role="alert">{cart.error} <button className="text-link" onClick={cart.retry}>Reload bag</button></div>}
    {cart.saving && <div className="cart-status" role="status">Saving your bag...</div>}
    <main>
      <Routes>
        <Route path="/" element={<HomePage categories={categories} />} />
        <Route path="/shop" element={<ShopPage categories={categories} />} />
        <Route path="/product/:slug" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/orders" element={<MyOrdersPage />} />
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
    <Footer />
  </>;
}

function SearchOverlay({ onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length > 1) api(`/products?search=${encodeURIComponent(query)}&limit=5`).then((data) => setResults(data.products)).catch(() => setResults([]));
      else setResults([]);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  return <motion.div className="search-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="search-box" initial={{ y: -16 }} animate={{ y: 0 }} onClick={(event) => event.stopPropagation()}>
      <div className="search-input-wrap"><Search size={20} /><input autoFocus placeholder="Search jewellery, materials, styles..." value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Escape" && onClose()} /><button className="icon-btn" onClick={onClose} aria-label="Close search"><X /></button></div>
      {query.trim().length > 1 && <div className="search-results">
        {results.length ? results.map((product) => <Link key={product._id} to={`/product/${product.slug}`} className="search-result" onClick={onClose}><img src={product.images?.[0] || imageFallback} alt="" /><span>{product.name}<small>{money(product.price)}</small></span><ArrowUpRight size={17} /></Link>) : <p className="empty-note">No exact matches. Try a material, colour or category.</p>}
        <Link to={`/shop?search=${encodeURIComponent(query)}`} className="all-results" onClick={onClose}>View all results <ArrowRight size={16} /></Link>
      </div>}
      {!query && <p className="search-hint">Try “gold chain” or “everyday earrings”</p>}
    </motion.div>
  </motion.div>;
}

function HomePage({ categories }) {
  const [products, setProducts] = useState([]);
  useEffect(() => { api("/products?featured=true&limit=8").then((data) => setProducts(data.products)).catch(() => setProducts([])); }, []);
  const cards = products.length ? products : [];
  return <>
    <section className="hero">
      <div className="hero-copy"><span className="eyebrow"><span className="eyebrow-line" /> THE ART OF EVERYDAY</span><h1>Every detail<br />tells a <em>story.</em></h1><p>Considered pieces for all the moments that make you, you.</p><div className="hero-actions"><Link to="/shop" className="button button-dark">Explore the collection <ArrowRight size={17} /></Link><Link to="/shop?sort=newest" className="text-link">Discover new arrivals <ArrowDown size={15} /></Link></div><div className="hero-note"><span>01 — 06</span><i /> A study in golden light</div></div>
      <div className="hero-image"><img src="https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=1500&q=90" alt="Golden jewellery styled in warm natural light" /><div className="hero-image-tag"><Sparkles size={15} /> A little golden hour</div><div className="hero-image-number">01<span>/</span>06</div></div>
    </section>
    <div className="promise-strip"><span>Made for your everyday</span><i /> <span>Thoughtful details</span><i /> <span>Pieces to keep close</span></div>
    <section className="section category-section"><div className="section-heading"><div><span className="eyebrow">FIND YOUR FEELING</span><h2>Shop by <em>category</em></h2></div><Link to="/shop" className="text-link">View all categories <ArrowRight size={15} /></Link></div>
      <div className="category-grid">{categories.slice(0, 6).map((category, index) => <Link to={`/shop?category=${category.slug}`} className="category-card" key={category._id}><img src={category.image || imageFallback} alt="" loading="lazy" /><div className="category-shade" /><span className="category-number">0{index + 1}</span><div className="category-title">{category.name}<ArrowUpRight size={17} /></div></Link>)}
      {!categories.length && <div className="empty-categories">Your next favourite piece is just around the corner.</div>}</div>
    </section>
    <section className="section featured-section"><div className="section-heading"><div><span className="eyebrow">THE PIECES YOU LOVE</span><h2>Everyday <em>favourites</em></h2></div><Link to="/shop?sort=popular" className="text-link">Shop bestsellers <ArrowRight size={15} /></Link></div>
      {cards.length ? <ProductGrid products={cards.slice(0, 4)} /> : <div className="empty-categories product-empty">Our collection is being curated. Please check back soon.</div>}
    </section>
    <section className="editorial">
      <div className="editorial-image"><img src="https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1100&q=85" alt="A collection of elegant jewellery" loading="lazy" /></div>
      <div className="editorial-copy"><span className="eyebrow">A NOTE FROM US</span><h2>Made to be<br /><em>worn, loved,</em><br />remembered.</h2><p>Jewellery isn't saved for the big occasions. It's part of the small rituals, the familiar places, and the stories we carry with us.</p><Link to="/shop" className="button button-outline">Find your everyday piece <ArrowRight size={16} /></Link></div>
      <div className="editorial-side-note">A QUIETER KIND OF BEAUTY&nbsp; — &nbsp;01</div>
    </section>
    <section className="newsletter"><span className="eyebrow">LETTERS FROM PRATHIKA</span><h2>A little beauty in<br /><em>your inbox.</em></h2><p>New pieces, thoughtful notes, and the occasional little surprise.</p><NewsletterForm /></section>
  </>;
}

function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const submit = (event) => { event.preventDefault(); if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) setDone(true); };
  return <form className="newsletter-form" onSubmit={submit}><input type="email" placeholder="Your email address" value={email} onChange={(event) => setEmail(event.target.value)} required aria-label="Email address" /><button aria-label="Subscribe" type="submit">{done ? <Check /> : <ArrowRight />}</button>{done && <small className="newsletter-success">Thank you for joining us.</small>}</form>;
}

function ProductGrid({ products }) {
  const { add, loading: cartLoading } = useCart();
  return <div className="product-grid">{products.map((product) => <article className="product-card" key={product._id}>
    <Link to={`/product/${product.slug}`} className="product-image"><img src={product.images?.[0] || imageFallback} alt={product.name} loading="lazy" />{product.isNew && <span className="product-badge">Just arrived</span>}<button className="quick-add" aria-label={`Add ${product.name} to bag`} disabled={product.stock < 1 || cartLoading} onClick={(event) => { event.preventDefault(); add(product); }}>{product.stock < 1 ? "Sold out" : "Quick add"} <Plus size={14} /></button></Link>
    <div className="product-meta"><Link to={`/product/${product.slug}`}><h3>{product.name}</h3></Link><span>{money(product.price)}</span></div><div className="product-submeta">{product.material || "Thoughtful details"} <span>{product.stock < 1 ? "Out of stock" : "In stock"}</span></div>
  </article>)}</div>;
}

function ShopPage({ categories }) {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ products: [], total: 0, pages: 0 });
  const [error, setError] = useState("");
  const search = params.get("search") || "";
  const category = params.get("category") || "";
  const sort = params.get("sort") || "newest";
  const minPrice = params.get("minPrice") || "";
  const maxPrice = params.get("maxPrice") || "";
  useEffect(() => {
    const query = new URLSearchParams({ search, sort, page: params.get("page") || "1" });
    if (category) query.set("category", category);
    if (minPrice) query.set("minPrice", minPrice);
    if (maxPrice) query.set("maxPrice", maxPrice);
    api(`/products?${query}`).then((result) => { setData(result); setError(""); }).catch((failure) => setError(failure.message));
  }, [search, category, sort, minPrice, maxPrice, params]);
  const setFilter = (key, value) => setParams((current) => { const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); next.delete("page"); return next; });
  return <section className="shop-page"><div className="shop-intro"><span className="eyebrow">A COLLECTION TO CALL YOURS</span><h1>{search ? <>Search results for <em>“{search}”</em></> : category ? <>{categories.find((item) => item.slug === category)?.name || "Our collection"}</> : <>The <em>collection</em></>}</h1><p>{data.total} pieces, each with a story to tell.</p></div>
    <div className="shop-toolbar"><div className="filter-group"><label><span>Category</span><select value={category} onChange={(event) => setFilter("category", event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item._id} value={item.slug}>{item.name}</option>)}</select></label><label className="price-filter"><span>Price from</span><input aria-label="Minimum price" type="number" min="0" placeholder="₹0" value={minPrice} onChange={(event) => setFilter("minPrice", event.target.value)} /></label><label className="price-filter"><span>To</span><input aria-label="Maximum price" type="number" min="0" placeholder="Any" value={maxPrice} onChange={(event) => setFilter("maxPrice", event.target.value)} /></label></div><label className="sort-select"><span>Sort by</span><select value={sort} onChange={(event) => setFilter("sort", event.target.value)}><option value="newest">Recently added</option><option value="popular">Bestsellers</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select></label></div>
    {error ? <div className="empty-state"><h2>We couldn't load the collection.</h2><p>{error}</p><button className="button button-outline" onClick={() => window.location.reload()}>Try again</button></div> : data.products.length ? <ProductGrid products={data.products} /> : <div className="empty-state"><div className="empty-orbit">✦</div><h2>No pieces found just yet.</h2><p>Try a different search or browse the whole collection.</p><Link className="button button-outline" to="/shop">Explore all pieces</Link></div>}
  </section>;
}

function ProductPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const { add, loading: cartLoading } = useCart();
  const navigate = useNavigate();
  useEffect(() => { api(`/products/${slug}`).then(setData).catch((failure) => setError(failure.message)); }, [slug]);
  if (error) return <div className="empty-state"><h2>We couldn't find this piece.</h2><Link className="button button-outline" to="/shop">Back to collection</Link></div>;
  if (!data) return <div className="page-loading"><span className="spinner" /> Finding your piece</div>;
  const { product, related } = data;
  const images = product.images?.length ? product.images : [imageFallback];
  const buyNow = () => { add(product, quantity); navigate("/checkout"); };
  return <div className="product-detail-page"><div className="breadcrumbs"><Link to="/">Home</Link><ChevronRight size={13} /><Link to="/shop">Shop</Link><ChevronRight size={13} /><span>{product.name}</span></div><div className="product-detail">
    <div className="gallery"><div className="gallery-main"><img src={images[imageIndex]} alt={product.name} /><span className="gallery-label">PRATHIKA / OBJECTS OF BEAUTY</span></div>{images.length > 1 && <div className="gallery-thumbs">{images.map((image, index) => <button key={image} className={index === imageIndex ? "active" : ""} onClick={() => setImageIndex(index)}><img src={image} alt={`${product.name} view ${index + 1}`} /></button>)}</div>}</div>
    <div className="product-info"><span className="eyebrow">{product.jewelleryType || "A PRATHIKA ORIGINAL"}</span><h1>{product.name}</h1><div className="detail-price">{money(product.price)}{product.mrp > product.price && <><del>{money(product.mrp)}</del><span>{Math.round((1 - product.price / product.mrp) * 100)}% off</span></>}</div><p className="product-description">{product.description}</p><div className="details-rule" />
      <dl className="product-attributes">{[["Material", product.material], ["Colour", product.colour], ["Finish", product.plating], ["SKU", product.sku]].filter((entry) => entry[1]).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="stock-status"><span className={product.stock > 0 ? "stock-dot" : "stock-dot sold"} />{product.stock > 0 ? `${product.stock < 6 ? "Only " + product.stock + " left" : "Ready to find a home"}` : "Currently unavailable"}</div><div className="purchase-row"><div className="quantity-picker"><button disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)} aria-label="Decrease quantity"><Minus size={15} /></button><span>{quantity}</span><button disabled={quantity >= Math.min(product.stock, 20)} onClick={() => setQuantity(quantity + 1)} aria-label="Increase quantity"><Plus size={15} /></button></div><button className="button button-dark add-to-bag" disabled={product.stock < 1 || cartLoading} onClick={() => add(product, quantity)}>{product.stock < 1 ? "Sold out" : "Add to bag"} <ShoppingBag size={16} /></button></div><button className="button button-gold buy-now" disabled={product.stock < 1 || cartLoading} onClick={buyNow}>Buy now <ArrowRight size={16} /></button><p className="shipping-note">Delivery details are shown in your bag.</p><div className="details-rule" /><div className="care-note"><Sparkles size={18} /><p><strong>A note on care</strong><br />Keep your piece away from moisture, perfume and direct heat. Store it softly, and it will stay close for longer.</p></div></div>
  </div>{related.length > 0 && <section className="section related-section"><div className="section-heading"><div><span className="eyebrow">A FEW MORE TO LOVE</span><h2>Pieces that <em>belong together</em></h2></div><Link to="/shop" className="text-link">See the collection <ArrowRight size={15} /></Link></div><ProductGrid products={related} /></section>}</div>;
}

function CartPage() {
  const { items, subtotal, setQuantity, remove, shippingSettings, loading } = useCart();
  if (loading) return <div className="page-loading"><span className="spinner" /> Loading your bag</div>;
  const shipping = subtotal === 0 ? 0 : getShippingCharge(subtotal, shippingSettings);
  return <section className="cart-page"><div className="shop-intro"><span className="eyebrow">YOUR LITTLE COLLECTION</span><h1>Your <em>bag</em></h1><p>{items.length} {items.length === 1 ? "piece" : "pieces"} selected</p></div>
    {!items.length ? <div className="empty-state"><div className="empty-orbit"><ShoppingBag size={25} /></div><h2>Your bag is waiting for something lovely.</h2><p>Take a look around and find the piece that feels like you.</p><Link className="button button-dark" to="/shop">Explore the collection <ArrowRight size={16} /></Link></div> : <div className="cart-layout"><div className="cart-items">{items.map((item) => <article className="cart-item" key={item._id}><Link to={`/product/${item.slug}`}><img src={item.images?.[0] || imageFallback} alt={item.name} /></Link><div className="cart-item-info"><span className="eyebrow">{item.jewelleryType || "PRATHIKA JEWELLERS"}</span><Link to={`/product/${item.slug}`}><h3>{item.name}</h3></Link><p>{item.colour} · {item.material}</p><div className="quantity-picker cart-quantity"><button onClick={() => item.quantity <= 1 ? remove(item._id) : setQuantity(item._id, item.quantity - 1)} aria-label="Decrease quantity"><Minus size={14} /></button><span>{item.quantity}</span><button disabled={item.quantity >= item.stock} onClick={() => setQuantity(item._id, item.quantity + 1)} aria-label="Increase quantity"><Plus size={14} /></button></div></div><div className="cart-item-end"><strong>{money(item.price * item.quantity)}</strong><button className="remove-button" onClick={() => remove(item._id)}>Remove</button></div></article>)}</div><aside className="order-summary"><span className="eyebrow">A LITTLE SUMMARY</span><h2>Your order</h2><div className="summary-line"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="summary-line"><span>Delivery</span><span>{shipping === null ? "Calculated at checkout" : shipping ? money(shipping) : "Complimentary"}</span></div><div className="summary-line summary-total"><span>Total</span><span>{shipping === null ? "—" : money(subtotal + shipping)}</span></div><p className="shipping-progress">{shipping === null ? "Delivery charges are confirmed before payment." : shipping === 0 ? "Complimentary delivery is yours." : `Delivery is ${money(shipping)} for this order.`}</p><Link to="/checkout" className="button button-dark full-button">Continue to checkout <ArrowRight size={16} /></Link><Link to="/shop" className="continue-link"><ArrowLeft size={15} /> Keep exploring</Link></aside></div>}
  </section>;
}

function CheckoutPage() {
  const { items, subtotal, clear, shippingSettings, loading: cartLoading, saving: cartSaving } = useCart();
  const user = useAuthUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", line1: "", landmark: "", city: "", state: "", pinCode: "", password: "", confirmPassword: "" });
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const navigate = useNavigate();
  const shipping = getShippingCharge(subtotal, shippingSettings);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  useEffect(() => {
    if (user) setForm((current) => ({ ...current, name: current.name || user.name, email: current.email || user.email }));
  }, [user]);
  const submit = async (event) => {
    event.preventDefault();
    if (cartLoading || cartSaving) { setError("Please wait for your bag to finish saving."); return; }
    if (!user && form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    if (paymentMethod === "razorpay" && !window.Razorpay) {
      setError("Secure payment checkout is unavailable. Please try again or choose cash on delivery.");
      return;
    }
    setLoading(true); setError("");
    try {
      const result = await api("/orders", {
        method: "POST",
        body: JSON.stringify({
          customer: { name: form.name, email: form.email, phone: form.phone },
          address: { line1: form.line1, landmark: form.landmark, city: form.city, state: form.state, pinCode: form.pinCode },
          items: items.map((item) => ({ productId: item._id, quantity: item.quantity })),
          paymentMethod,
          ...(!user ? { account: { password: form.password } } : {})
        })
      });
      if (paymentMethod === "razorpay") {
        const razorpay = new window.Razorpay({
          key: result.payment.keyId,
          amount: result.payment.amount,
          currency: result.payment.currency,
          name: "Prathika Jewellers",
          description: "A little something beautiful",
          order_id: result.payment.id,
          prefill: { name: form.name, email: form.email, contact: form.phone },
          theme: { color: "#b69c6b" },
          handler: async (response) => {
            try {
              const verified = await api("/orders/verify-payment", { method: "POST", body: JSON.stringify({ orderReference: result.order.reference, ...response }) });
              if (result.accountCreated) {
                await authSession.refresh();
                navigate(`/orders?placed=${encodeURIComponent(verified.order.reference)}`, { replace: true });
              } else {
                await clear(); setComplete(verified.order);
              }
            } catch (failure) { setError(failure.message); setLoading(false); }
            finally { setLoading(false); }
          },
          modal: { ondismiss: async () => { if (result.accountCreated) await authSession.refresh(); setLoading(false); } }
        });
        razorpay.on("payment.failed", async (failure) => { setError(failure.error?.description || "Payment did not go through. Please try again."); if (result.accountCreated) await authSession.refresh(); setLoading(false); });
        razorpay.open();
        return;
      }
      if (result.accountCreated) {
        await authSession.refresh();
        navigate(`/orders?placed=${encodeURIComponent(result.order.reference)}`, { replace: true });
      } else {
        await clear(); setComplete(result.order);
      }
      setLoading(false);
    } catch (failure) { setError(failure.message); setLoading(false); }
  };
  if (cartLoading) return <div className="page-loading"><span className="spinner" /> Loading your bag</div>;
  if (complete) return <section className="checkout-success"><div className="success-icon"><Check /></div><span className="eyebrow">A BEAUTIFUL CHOICE</span><h1>Thank you for<br /><em>your order.</em></h1><p>Your reference is <strong>{complete.reference}</strong>. We’ll take it from here.</p>{user && <Link to="/orders" className="button button-outline">View my orders <ArrowRight size={16} /></Link>}<Link to="/" className="button button-dark">Back to the beginning <ArrowRight size={16} /></Link></section>;
  if (!items.length) return <div className="empty-state"><h2>Your bag is empty.</h2><Link className="button button-dark" to="/shop">Explore our collection</Link></div>;
  return <section className="checkout-page"><div className="shop-intro"><span className="eyebrow">JUST A FEW DETAILS</span><h1>Make it <em>yours.</em></h1><p>{user ? "Your details are only used to take care of this order." : "We'll create your account so you can follow this order later."}</p></div><div className="checkout-layout"><form className="checkout-form" onSubmit={submit}><div className="form-section"><div className="form-section-title"><span>01</span><h2>Your details</h2></div><div className="form-grid"><Field label="Full name" required autoComplete="name" value={form.name} onChange={update("name")} /><Field label="Email address" type="email" required autoComplete="email" value={form.email} onChange={update("email")} /><Field label="Mobile number" type="tel" required autoComplete="tel" placeholder="10-digit number" value={form.phone} onChange={update("phone")} pattern="[6-9][0-9]{9}" />{!user && <><Field label="Create password" type="password" required autoComplete="new-password" minLength={10} maxLength={100} value={form.password} onChange={update("password")} /><Field label="Confirm password" type="password" required autoComplete="new-password" minLength={10} maxLength={100} value={form.confirmPassword} onChange={update("confirmPassword")} /><p className="field-help field-wide">Use at least 10 characters. Your account lets you view this order and its delivery status.</p></>}</div></div><div className="form-section"><div className="form-section-title"><span>02</span><h2>Where it’s going</h2></div><div className="form-grid"><Field label="Address" required value={form.line1} onChange={update("line1")} wide /><Field label="Landmark (optional)" value={form.landmark} onChange={update("landmark")} wide /><Field label="City" required value={form.city} onChange={update("city")} /><Field label="State" required value={form.state} onChange={update("state")} /><Field label="PIN code" required value={form.pinCode} onChange={update("pinCode")} pattern="[1-9][0-9]{5}" /></div></div><div className="form-section"><div className="form-section-title"><span>03</span><h2>Payment, your way</h2></div><label className={`payment-option ${paymentMethod === "cod" ? "selected" : ""}`}><input type="radio" name="payment" value="cod" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} /><span><strong>Cash on delivery</strong><small>Pay when your order arrives</small></span><span className="radio-dot" /></label><label className={`payment-option ${paymentMethod === "razorpay" ? "selected" : ""}`}><input type="radio" name="payment" value="razorpay" checked={paymentMethod === "razorpay"} onChange={() => setPaymentMethod("razorpay")} /><span><strong>UPI, card or net banking</strong><small>Secure checkout powered by Razorpay</small></span><span className="radio-dot" /></label></div>{error && <div className="form-error" role="alert">{error}</div>}<button type="submit" className="button button-dark full-button" disabled={loading || cartSaving}>{loading ? "One moment..." : cartSaving ? "Saving your bag..." : shipping === null ? "Place order" : `Place order · ${money(subtotal + shipping)}`} <ArrowRight size={16} /></button><p className="checkout-disclaimer">Your order total is recalculated securely before it is placed.</p></form><aside className="order-summary checkout-summary"><span className="eyebrow">JUST FOR YOU</span><h2>In your bag</h2>{items.map((item) => <div className="summary-product" key={item._id}><img src={item.images?.[0] || imageFallback} alt="" /><span>{item.name}<small>Qty {item.quantity}</small></span><strong>{money(item.price * item.quantity)}</strong></div>)}<div className="summary-line"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="summary-line"><span>Delivery</span><span>{shipping === null ? "Calculated at checkout" : shipping ? money(shipping) : "Complimentary"}</span></div><div className="summary-line summary-total"><span>Total</span><span>{shipping === null ? "—" : money(subtotal + shipping)}</span></div></aside></div></section>;
}

function Field({ label, wide = false, ...props }) {
  return <label className={`field ${wide ? "field-wide" : ""}`}><span>{label}{props.required && <i> *</i>}</span><input {...props} /></label>;
}

function AccountPage() {
  const user = useAuthUser();
  const location = useLocation();
  const resetToken = useMemo(() => new URLSearchParams(location.hash.slice(1)).get("reset") || "", [location.hash]);
  const [mode, setMode] = useState(resetToken ? "reset" : "login");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState(null);
  const navigate = useNavigate();
  useEffect(() => { api("/auth/config").then(setConfig).catch(() => setConfig({ googleEnabled: false })); }, []);
  useEffect(() => { if (resetToken) setMode("reset"); }, [resetToken]);
  const oauthErrors = { google_unavailable: "Google sign-in is currently unavailable. Please use your email and password.", google_cancelled: "Google sign-in was cancelled. You can try again.", google_failed: "Google sign-in could not be completed. Please try again.", use_password: "This email already has an account. Please sign in with your password." };
  const oauthError = oauthErrors[new URLSearchParams(location.search).get("auth_error")];
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const changeMode = (next) => {
    setMode(next); setError(""); setNotice(""); setForm((current) => ({ ...current, password: "", confirmPassword: "" }));
    navigate("/account", { replace: true });
  };
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (mode === "forgot") {
        const data = await api("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: form.email }) });
        setNotice(data.message);
      } else if (mode === "reset") {
        if (form.password !== form.confirmPassword) throw new Error("Passwords do not match.");
        const data = await api("/auth/reset-password", { method: "POST", body: JSON.stringify({ token: resetToken, password: form.password }) });
        authSession.clear(); setMode("login"); setNotice(data.message); setForm((current) => ({ ...current, password: "", confirmPassword: "" })); navigate("/account", { replace: true });
      } else {
        const signedInUser = await authSession.signIn(mode, form);
        if (signedInUser.role === "admin") navigate("/admin");
      }
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  };
  const logout = async () => {
    setBusy(true); setError("");
    try { await authSession.signOut(); setMode("login"); setForm({ name: "", email: "", password: "", confirmPassword: "" }); setNotice("You have been signed out."); navigate("/account", { replace: true }); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  };
  if (user === undefined && mode !== "reset") return <div className="page-loading"><span className="spinner" /> Checking your account</div>;
  if (user && mode !== "reset") return <section className="account-page"><div className="account-welcome"><span className="eyebrow">WELCOME BACK</span><h1>Hello, <em>{user.name.split(" ")[0]}.</em></h1><p>Signed in as {user.email}</p><Link className="button button-outline" to="/orders">My orders <ArrowRight size={16} /></Link>{user.role === "admin" && <Link className="button button-dark" to="/admin">Open your dashboard <ArrowRight size={16} /></Link>}{error && <div role="alert" className="form-error">{error}</div>}<button className="text-link logout-link" disabled={busy} onClick={logout}>{busy ? "Signing out..." : "Sign out"}</button></div></section>;
  const isPasswordFlow = mode === "forgot" || mode === "reset";
  return <section className="account-page"><div className="account-card">
    <span className="eyebrow">{isPasswordFlow ? "YOUR ACCOUNT" : mode === "login" ? "WELCOME BACK" : "A LOVELY PLACE TO BEGIN"}</span>
    <h1>{mode === "forgot" ? <>Forgot your <em>password?</em></> : mode === "reset" ? <>Choose a new <em>password.</em></> : mode === "login" ? <>Sign in to <em>your account.</em></> : <>Create your <em>account.</em></>}</h1>
    <p>{mode === "forgot" ? "Enter your email address and we will send you a link to reset your password." : mode === "reset" ? "Use at least 10 characters for your new password." : "Keep your favourites close, and your orders in one place."}</p>
    {(error || oauthError) && <div role="alert" className="form-error">{error || oauthError}</div>}{notice && <div role="status" className="form-success">{notice}</div>}
    <form onSubmit={submit}>
      {mode === "register" && <Field label="Your name" required autoComplete="name" value={form.name} onChange={update("name")} minLength={2} />}
      {mode !== "reset" && <Field label="Email address" type="email" required autoComplete="email" value={form.email} onChange={update("email")} />}
      {mode !== "forgot" && <Field label={mode === "reset" ? "New password" : "Password"} type="password" required autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={update("password")} minLength={mode === "login" ? 1 : 10} maxLength={100} />}
      {mode === "reset" && <Field label="Confirm new password" type="password" required autoComplete="new-password" value={form.confirmPassword} onChange={update("confirmPassword")} minLength={10} maxLength={100} />}
      {mode === "login" && <button type="button" className="text-link forgot-password-link" onClick={() => changeMode("forgot")}>Forgot password?</button>}
      <button className="button button-dark full-button" disabled={busy}>{busy ? "One moment..." : mode === "forgot" ? "Send reset link" : mode === "reset" ? "Update password" : mode === "login" ? "Sign in" : "Create account"} <ArrowRight size={16} /></button>
    </form>
    {!isPasswordFlow && <><div className="auth-divider"><span>or</span></div><button className="button button-outline full-button google-signin" disabled={busy || !config?.googleEnabled} onClick={() => { window.location.assign(`${apiBaseUrl}/auth/google`); }}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.3 2.9-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-4V7.4H3a10 10 0 0 0 0 9.2L6.4 14Z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-9 5.4L6.4 10A6 6 0 0 1 12 5.9Z"/></svg>Continue with Google</button>{config && !config.googleEnabled && <p className="auth-availability">Google sign-in is currently unavailable.</p>}</>}
    <button className="text-link account-toggle" disabled={busy} onClick={() => changeMode(isPasswordFlow || mode === "register" ? "login" : "register")}>{isPasswordFlow ? "Back to sign in" : mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}</button>
  </div></section>;
}

function MyOrdersPage() {
  const user = useAuthUser();
  if (user === undefined) return <div className="page-loading"><span className="spinner" /> Checking your account</div>;
  if (!user) return <section className="account-page"><div className="empty-state"><h1>Your orders</h1><p>Sign in to view your orders and their current status.</p><Link className="button button-dark" to="/account">Sign in <ArrowRight size={16} /></Link></div></section>;
  return <CustomerOrders key={user.id} />;
}

function CustomerOrders() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number.parseInt(params.get("page"), 10) || 1);
  const placedReference = params.get("placed");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === "visible") setRefresh((value) => value + 1); }, 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    setBusy(true); setError("");
    api(`/orders/mine?page=${page}`).then((result) => { if (active) setData(result); }).catch((failure) => { if (active) setError(failure.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [page, refresh]);
  return <section className="customer-orders-page"><div className="shop-intro"><span className="eyebrow">YOUR PRATHIKA COLLECTION</span><h1>My <em>orders</em></h1><p>Follow your orders from confirmation to delivery.</p></div>
    {placedReference && <div className="form-success order-placed-notice" role="status"><Check size={18} /> Your order <strong>{placedReference}</strong> was placed successfully. Your account is ready and you’re signed in.</div>}
    <div className="customer-orders-toolbar"><Link className="text-link" to="/account"><ArrowLeft size={15} /> My account</Link><button className="text-link" disabled={busy} onClick={() => setRefresh((value) => value + 1)}>{busy ? "Updating..." : "Refresh status"}</button></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {!data && busy && <div className="page-loading"><span className="spinner" /> Loading your orders</div>}
    {data?.orders.map((order) => <AdminOrder key={order._id} order={order} />)}
    {data && !data.orders.length && <div className="empty-state"><ShoppingBag size={28} /><h2>No orders yet.</h2><p>Orders placed while signed in will appear here.</p><Link className="button button-dark" to="/shop">Explore the collection <ArrowRight size={16} /></Link></div>}
    {data && (data.pages > 1 || page > 1) && <div className="customer-order-pages"><button className="button button-outline" disabled={page <= 1 || busy} onClick={() => setParams({ page: String(page - 1) })}>Previous</button><span>Page {page} of {Math.max(data.pages, 1)}</span><button className="button button-outline" disabled={page >= data.pages || busy} onClick={() => setParams({ page: String(page + 1) })}>Next</button></div>}
  </section>;
}

function AdminPage() {
  const user = useAuthUser();
  const [signingOut, setSigningOut] = useState(false);
  const [section, setSection] = useState("products");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({ products: 0, orders: 0, lowStock: 0, revenue: 0, paidOrders: 0 });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [productForm, setProductForm] = useState({ name: "", sku: "", description: "", price: "", mrp: "", images: "", categoryId: "", material: "", colour: "", plating: "", stock: "", status: "published", isNew: false, isBestseller: false, featured: false });
  const [newCategory, setNewCategory] = useState("");
  const [categoryImage, setCategoryImage] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [productFilter, setProductFilter] = useState("active");
  const visibleProducts = products.filter((product) => productFilter === "all" || (productFilter === "archived" ? product.status === "archived" : product.status !== "archived"));
  const navigate = useNavigate();
  const load = async () => {
    try {
      const [productsData, catsData, ordersData, summaryData] = await Promise.all([
        api("/admin/products"), api("/admin/categories"), api("/admin/orders"), api("/admin/summary")
      ]);
      setProducts(productsData); setCategories(catsData); setOrders(ordersData); setSummary(summaryData);
    } catch (failure) { setError(failure.message); }
  };
  useEffect(() => { if (user?.role === "admin") load(); }, [user]);
  const logout = async () => {
    setSigningOut(true); setError("");
    try { await authSession.signOut(); navigate("/account", { replace: true }); }
    catch (failure) { setError(failure.message); } finally { setSigningOut(false); }
  };
  const setForm = (key, value) => setProductForm((current) => ({ ...current, [key]: value }));
  const saveProduct = async (event) => {
    event.preventDefault(); setError(""); setNotice("");
    const payload = {
      ...productForm,
      price: Number(productForm.price),
      mrp: Number(productForm.mrp),
      stock: Number(productForm.stock),
      images: productForm.images.split(/\n|,/).map((image) => image.trim()).filter(Boolean),
      categories: productForm.categoryId ? [productForm.categoryId] : []
    };
    try {
      await api(editing ? `/admin/products/${editing}` : "/admin/products", { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setNotice(editing ? "Product updated." : "Product created.");
      setEditing(null);
      setProductForm({ name: "", sku: "", description: "", price: "", mrp: "", images: "", categoryId: "", material: "", colour: "", plating: "", stock: "", status: "published", isNew: false, isBestseller: false, featured: false });
      await load();
    } catch (failure) { setError(failure.message); }
  };
  const editProduct = (product) => {
    setEditing(product._id);
    setProductForm({ ...product, images: (product.images || []).join("\n"), categoryId: product.categories?.[0]?._id || product.categories?.[0] || "", price: product.price, mrp: product.mrp, stock: product.stock });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const archiveProduct = async (id) => {
    if (!window.confirm("Archive this product? It will disappear from the storefront.")) return;
    try { await api(`/admin/products/${id}`, { method: "PATCH", body: JSON.stringify({ status: "archived" }) }); setNotice("Product archived."); await load(); }
    catch (failure) { setError(failure.message); }
  };
  const deleteProduct = async (product) => {
    if (!window.confirm(`Permanently delete "${product.name}"? This cannot be undone.`)) return;
    setError(""); setNotice("");
    try { await api(`/admin/products/${product._id}`, { method: "DELETE" }); setNotice("Product deleted."); if (editing === product._id) setEditing(null); await load(); }
    catch (failure) { setError(failure.message); }
  };
  const deleteCategory = async (category) => {
    if (!window.confirm(`Delete category "${category.name}"?`)) return;
    setError(""); setNotice("");
    try { await api(`/admin/categories/${category._id}`, { method: "DELETE" }); if (editingCategory === category._id) { setEditingCategory(null); setNewCategory(""); setCategoryImage(""); } setNotice("Category deleted."); await load(); }
    catch (failure) { setError(failure.message); }
  };
  const createCategory = async (event) => {
    event.preventDefault();
    setError(""); setNotice("");
    try { await api(editingCategory ? `/admin/categories/${editingCategory}` : "/admin/categories", { method: editingCategory ? "PATCH" : "POST", body: JSON.stringify({ name: newCategory, image: categoryImage }) }); setNewCategory(""); setCategoryImage(""); setEditingCategory(null); setNotice(editingCategory ? "Category updated." : "Category created."); await load(); }
    catch (failure) { setError(failure.message); }
  };
  const changeOrder = async (id, status) => {
    try { await api(`/admin/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); }
    catch (failure) { setError(failure.message); }
  };
  if (user === undefined) return <div className="page-loading"><span className="spinner" /> Opening the studio</div>;
  if (!user || user.role !== "admin") return <section className="admin-locked"><span className="eyebrow">THE PRATHIKA STUDIO</span><h1>A little behind<br /><em>the scenes.</em></h1><p>This space is for the people who care for the collection.</p><Link to="/account" className="button button-dark">Sign in as an administrator <ArrowRight size={16} /></Link></section>;
  return <section className="admin-page"><aside className="admin-sidebar"><Link to="/" className="admin-back"><ArrowLeft size={15} /> Back to storefront</Link><span className="eyebrow">THE PRATHIKA STUDIO</span><h2>Good things,<br /><em>well kept.</em></h2><nav>{[["products", "Product collection"], ["categories", "Categories"], ["orders", "Orders"]].map(([key, label]) => <button key={key} className={section === key ? "active" : ""} onClick={() => setSection(key)}>{label}<ArrowRight size={15} /></button>)}</nav><div className="admin-user"><span>{user.name[0]}</span>{user.name}<button disabled={signingOut} onClick={logout}>{signingOut ? "Signing out..." : "Sign out"}</button></div></aside><div className="admin-main"><header className="admin-heading"><div><span className="eyebrow">YOUR LITTLE WORLD, AT A GLANCE</span><h1>{section === "products" ? "The collection" : section === "categories" ? "Category notes" : "Orders, with care"}</h1></div><span className="admin-date">{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span></header>
      {error && <div className="form-error admin-message">{error}</div>}{notice && <div className="form-success admin-message"><Check size={15} />{notice}<button onClick={() => setNotice("")}><X size={15} /></button></div>}
      {section === "products" && <>
        <div className="admin-metrics"><Metric label="Collection pieces" value={summary.products} /><Metric label="Orders received" value={summary.orders} /><Metric label="Needs a look" value={summary.lowStock} /><Metric label="Paid revenue" value={money(summary.revenue)} /></div>
        <div className="admin-content-grid"><form className="admin-product-form" onSubmit={saveProduct}><div className="admin-form-heading"><div><span className="eyebrow">{editing ? "A FEW LITTLE CHANGES" : "A NEW ADDITION"}</span><h2>{editing ? "Edit this piece" : "Add a piece"}</h2></div>{editing && <button type="button" className="text-link" onClick={() => { setEditing(null); setProductForm({ name: "", sku: "", description: "", price: "", mrp: "", images: "", categoryId: "", material: "", colour: "", plating: "", stock: "", status: "published", isNew: false, isBestseller: false, featured: false }); }}>Cancel</button>}</div>
          <div className="form-grid"><Field label="Product name" required value={productForm.name} onChange={(event) => setForm("name", event.target.value)} /><Field label="Unique SKU" required value={productForm.sku} onChange={(event) => setForm("sku", event.target.value)} /><Field label="Selling price (₹)" type="number" min="0" required value={productForm.price} onChange={(event) => setForm("price", event.target.value)} /><Field label="MRP (₹)" type="number" min="0" required value={productForm.mrp} onChange={(event) => setForm("mrp", event.target.value)} /><label className="field field-wide"><span>Description</span><textarea rows="3" value={productForm.description} onChange={(event) => setForm("description", event.target.value)} /></label><label className="field"><span>Category</span><select value={productForm.categoryId} onChange={(event) => setForm("categoryId", event.target.value)}><option value="">Choose category</option>{categories.map((category) => <option value={category._id} key={category._id}>{category.name}</option>)}</select></label><Field label="Material" value={productForm.material} onChange={(event) => setForm("material", event.target.value)} /><Field label="Colour" value={productForm.colour} onChange={(event) => setForm("colour", event.target.value)} /><Field label="Finish / plating" value={productForm.plating} onChange={(event) => setForm("plating", event.target.value)} /><Field label="Available stock" type="number" min="0" required value={productForm.stock} onChange={(event) => setForm("stock", event.target.value)} /><label className="field"><span>Visibility</span><select value={productForm.status} onChange={(event) => setForm("status", event.target.value)}><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label><label className="field field-wide"><span>Image URL(s), separated by lines</span><textarea rows="2" value={productForm.images} onChange={(event) => setForm("images", event.target.value)} placeholder="https://..." /></label></div>
          <div className="admin-checks">{[["isNew", "New arrival"], ["isBestseller", "Bestseller"], ["featured", "Feature on home"]].map(([key, label]) => <label key={key}><input type="checkbox" checked={productForm[key] || false} onChange={(event) => setForm(key, event.target.checked)} /> {label}</label>)}</div><button className="button button-dark full-button">{editing ? "Save changes" : "Add to collection"} <ArrowRight size={15} /></button>
        </form><div className="admin-product-list"><div className="admin-list-title"><h2>In the collection</h2><span>{visibleProducts.length} pieces</span></div><label className="field admin-product-filter"><span>Show products</span><select value={productFilter} onChange={(event) => setProductFilter(event.target.value)}><option value="active">Active products</option><option value="archived">Archived products</option><option value="all">All products</option></select></label>{visibleProducts.map((product) => <article key={product._id} className="admin-product-row"><img src={product.images?.[0] || imageFallback} alt="" /><div><strong>{product.name}</strong><small>{product.sku} · {money(product.price)}</small></div><span className={`admin-stock ${product.stock <= product.lowStockThreshold ? "low" : ""}`}>{product.status} ? {product.stock} in stock</span><button aria-label={`Edit ${product.name}`} onClick={() => editProduct(product)}>Edit</button><div className="admin-row-actions">{product.status !== "archived" && <button aria-label={`Archive ${product.name}`} onClick={() => archiveProduct(product._id)}>Archive</button>}<button className="danger-link" aria-label={`Delete ${product.name}`} onClick={() => deleteProduct(product)}>Delete</button></div></article>)}{!visibleProducts.length && <p className="empty-note">No products in this view.</p>}</div></div>
      </>}
      {section === "categories" && <div className="admin-categories"><form onSubmit={createCategory} className="category-create"><span className="eyebrow">GROW YOUR COLLECTION</span><h2>{editingCategory ? "Edit category" : "A new category."}</h2><p>Categories are created as you need them and appear in your shop navigation.</p><div className="category-create-row"><input required minLength="2" maxLength="80" placeholder="For example, Pearl Jewellery" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} /><button className="button button-dark">{editingCategory ? "Save" : "Create"} <Plus size={15} /></button></div><Field label="Category image URL" type="url" value={categoryImage} onChange={(event) => setCategoryImage(event.target.value)} />{editingCategory && <button type="button" className="text-link" onClick={() => { setEditingCategory(null); setNewCategory(""); setCategoryImage(""); }}>Cancel editing</button>}</form><div className="admin-category-list">{categories.map((category) => <div key={category._id}><img src={category.image || imageFallback} alt="" /><span>{category.name}</span><div className="admin-row-actions"><button className="text-link" onClick={() => { setEditingCategory(category._id); setNewCategory(category.name); setCategoryImage(category.image || ""); }}>Edit</button><button className="text-link danger-link" onClick={() => deleteCategory(category)}>Delete</button></div></div>)}</div></div>}
      {section === "orders" && <div className="admin-orders"><div className="admin-list-title"><div><span className="eyebrow">TAKE IT FROM HERE</span><h2>Orders to look after</h2></div><span>{orders.length} total</span></div>{orders.map((order) => <AdminOrder key={order._id} order={order} onStatusChange={changeOrder} />)}{!orders.length && <div className="empty-note">No orders yet. They’ll find their way here.</div>}</div>}
    </div></section>;
}

function AdminOrder({ order, onStatusChange }) {
  const transitions = { confirmed: ["processing", "cancelled"], processing: ["packed", "cancelled"], packed: ["shipped", "cancelled"], shipped: ["delivered"] };
  const nextStatuses = (typeof onStatusChange === "function" ? transitions[order.status] || [] : []).filter((status) => status !== "cancelled" || order.paymentStatus !== "paid");
  return <article className="admin-order-card">
    <div className="admin-order-row"><div><strong>{order.reference}</strong><small>{order.customer.name} ? {new Date(order.createdAt).toLocaleString("en-IN")}</small></div><span>{money(order.total)}</span><span className="order-status">{order.status.replaceAll("_", " ")}</span>{nextStatuses.length > 0 && <select aria-label={`Update status for ${order.reference}`} value="" onChange={(event) => onStatusChange(order._id, event.target.value)}><option value="" disabled>Update status</option>{nextStatuses.map((status) => <option value={status} key={status}>{status}</option>)}</select>}</div>
    <details className="admin-order-details"><summary>View order details</summary>
      <div className="admin-order-info"><div><h3>Customer</h3><p>{order.customer.name}<br /><a href={`mailto:${order.customer.email}`}>{order.customer.email}</a><br /><a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a></p></div>
      <div><h3>Delivery address</h3><p>{order.address.line1}<br />{order.address.landmark && <>{order.address.landmark}<br /></>}{order.address.city}, {order.address.state} ? {order.address.pinCode}</p></div>
      <div><h3>Payment</h3><p>{order.paymentMethod === "cod" ? "Cash on delivery" : "Razorpay"}<br />Status: {order.paymentStatus}</p>{order.razorpayPaymentId && <p>Payment ID: {order.razorpayPaymentId}</p>}{order.razorpayOrderId && <p>Payment order ID: {order.razorpayOrderId}</p>}</div></div>
      <h3>Items ordered</h3>{order.items.map((item, index) => <div className="admin-order-item" key={`${item.product}-${index}`}><img src={item.image || imageFallback} alt="" /><div><strong>{item.name}</strong><small>SKU: {item.sku}</small><small>{item.quantity} ? {money(item.unitPrice)}</small></div><strong>{money(item.quantity * item.unitPrice)}</strong></div>)}
      <div className="admin-order-totals"><p><span>Subtotal</span><strong>{money(order.subtotal)}</strong></p><p><span>Shipping</span><strong>{money(order.shipping)}</strong></p><p><span>Total</span><strong>{money(order.total)}</strong></p></div>
    </details>
  </article>;
}

function Metric({ label, value }) { return <div className="admin-metric"><span className="eyebrow">{label}</span><strong>{value}</strong></div>; }

function Footer() {
  return <footer className="site-footer"><div className="footer-main"><div className="footer-brand"><BrandLogo /><p>For all the moments that make you, you.</p></div><div className="footer-links"><div><span className="eyebrow">EXPLORE</span><Link to="/shop">Shop all</Link><Link to="/shop?sort=newest">New arrivals</Link><Link to="/shop?sort=popular">Bestsellers</Link></div><div><span className="eyebrow">HERE FOR YOU</span><Link to="/account">My account</Link><Link to="/orders">My orders</Link><Link to="/cart">Your bag</Link><a href="mailto:hello@prathikajewellers.in">Get in touch</a></div><div><span className="eyebrow">A LITTLE NOTE</span><p>Thoughtful pieces.<br />Made to be worn and loved.</p></div></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Prathika Jewellers</span><span>Made with a little love, in India <span className="footer-star">✦</span></span><Link to="/admin">Studio</Link></div></footer>;
}

function NotFound() {
  return <div className="empty-state"><div className="empty-orbit">✦</div><h1>This page wandered <em>off.</em></h1><p>Let’s find our way back to something lovely.</p><Link className="button button-dark" to="/">Back home <ArrowRight size={16} /></Link></div>;
}

export default App;
