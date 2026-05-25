import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import {
  Sparkles,
  Loader,
  ArrowLeft,
  Send,
  Image as ImageIcon,
} from "lucide-react";

import { createClient } from "@supabase/supabase-js";

import api from "../../services/api";
import { useToastStore } from "../../store/toastStore";

// ======================================
// SUPABASE
// ======================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ======================================
// COMPONENT
// ======================================

export const AddProduct = () => {
  const navigate = useNavigate();

  const { addToast } = useToastStore();

  // ======================================
  // FORM STATE
  // ======================================

  const [name, setName] = useState("");

  const [description, setDescription] = useState("");

  const [price, setPrice] = useState("");

  const [stock, setStock] = useState("");

  const [category, setCategory] = useState("Electronics");

  // ======================================
  // IMAGE STATE
  // ======================================

  const [imageFile, setImageFile] = useState<File | null>(null);

  const [previewUrl, setPreviewUrl] = useState("");

  // ======================================
  // LOADING STATE
  // ======================================

  const [isLoading, setIsLoading] = useState(false);

  const [isAiLoading, setIsAiLoading] = useState(false);

  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // ======================================
  // CLEANUP OBJECT URL
  // ======================================

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // ======================================
  // AI DESCRIPTION
  // ======================================

  const handleGenerateAiDescription = async () => {
    if (!name.trim()) {
      return addToast("Please enter a product name first.", "warning");
    }

    setIsAiLoading(true);

    try {
      const response = await api.post("/api/ai/generate-description", {
        productName: name,
      });

      setDescription(response.data.result);

      addToast("AI Description generated successfully!", "success");
    } catch (err) {
      console.error(err);

      const fallbackDesc = `Premium brand new ${name}.

Features:
1. Elite ergonomics
2. Durable build quality
3. Hyperlocal platform warranty
4. Verified vendor supply
5. Fluid design parameters

Buy today from local verified partners.`;

      setDescription(fallbackDesc);

      addToast(
        "AI Simulation: Created localized description blueprint.",
        "info",
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  // ======================================
  // IMAGE SELECT
  // ======================================

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    // IMAGE VALIDATION

    if (!file.type.startsWith("image/")) {
      return addToast("Only image files are allowed.", "warning");
    }

    // MAX 5MB

    if (file.size > 5 * 1024 * 1024) {
      return addToast("Image must be smaller than 5MB.", "warning");
    }

    setImageFile(file);

    // LOCAL PREVIEW ONLY
    // NO UPLOAD YET

    const objectUrl = URL.createObjectURL(file);

    setPreviewUrl(objectUrl);
  };

  // ======================================
  // SUPABASE UPLOAD
  // ======================================

  const uploadImageToSupabase = async (file: File) => {
    const fileExt = file.name.split(".").pop();

    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExt}`;

    // BUCKET NAME
    // MUST MATCH EXACTLY

    const bucketName = "images";

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("SUPABASE UPLOAD ERROR:", uploadError);

      throw uploadError;
    }

    // GET PUBLIC URL

    const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);

    return data.publicUrl;
  };

  // ======================================
  // SUBMIT
  // ======================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !description || !price || !stock || !category) {
      return addToast("Please fill out all required fields.", "warning");
    }

    setIsLoading(true);

    try {
      let uploadedImageUrl = "";

      // ======================================
      // UPLOAD ONLY AFTER USER CLICKS SUBMIT
      // ======================================

      if (imageFile) {
        setIsUploadingImage(true);

        uploadedImageUrl = await uploadImageToSupabase(imageFile);

        setIsUploadingImage(false);
      }

      // ======================================
      // SAVE PRODUCT TO BACKEND
      // ======================================

      await api.post("/api/products/", {
        name,
        description,
        price: parseFloat(price),
        stock: parseInt(stock),
        category,
        images: uploadedImageUrl ? [uploadedImageUrl] : [],
      });

      addToast("Product listed successfully!", "success");

      navigate("/seller/products");
    } catch (err: any) {
      console.error("PRODUCT SUBMIT ERROR:", err);

      addToast(err?.message || "Failed to publish product.", "error");
    } finally {
      setIsUploadingImage(false);

      setIsLoading(false);
    }
  };

  // ======================================
  // UI
  // ======================================

  return (
    <div className="space-y-8 max-w-2xl mx-auto animate-fadeIn">
      {/* TITLE */}

      <div>
        <button
          onClick={() => navigate("/seller/products")}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 mb-2 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to My Catalog
        </button>

        <h1 className="font-display font-black text-3xl text-slate-800">
          List New Product
        </h1>

        <p className="text-xs text-slate-500">
          Provide product technical specs and launch it hyperlocal catalog.
        </p>
      </div>

      {/* FORM */}

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 p-8 rounded-3xl shadow-sm space-y-6"
      >
        {/* NAME */}

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-500">
            Product Name
          </label>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="E.g., RGB Mechanical Gaming Keyboard"
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm bg-white text-slate-800 placeholder-slate-400"
          />
        </div>

        {/* DESCRIPTION */}

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase text-slate-500">
              Product Description
            </label>

            <button
              type="button"
              disabled={isAiLoading}
              onClick={handleGenerateAiDescription}
              className="btn-3d btn-3d-ai btn-shimmer-wrap disabled:opacity-50 text-[10px] px-3.5 py-1.5 flex items-center gap-1 scale-90"
            >
              {isAiLoading ? (
                <Loader className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              )}
              Generate Description with AI
            </button>
          </div>

          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Auto-generate with AI above or type manual details here..."
            className="w-full border border-slate-200 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-xs bg-white text-slate-800 placeholder-slate-400"
          />
        </div>

        {/* CATEGORY + IMAGE */}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* CATEGORY */}

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-500">
              Catalog Category
            </label>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm bg-white text-slate-800"
            >
              <option value="Electronics">Electronics</option>

              <option value="Fashion">Fashion</option>

              <option value="Home & Kitchen">Home & Kitchen</option>
            </select>
          </div>

          {/* IMAGE */}

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-500">
              Product Image
            </label>

            <label className="w-full border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-indigo-300 transition-colors bg-slate-50">
              <ImageIcon className="w-6 h-6 text-slate-400" />

              <span className="text-[11px] text-slate-500 text-center">
                Click to upload image
              </span>

              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>

            {/* FILE NAME */}

            {imageFile && (
              <p className="text-[10px] text-emerald-600 font-semibold">
                Selected: {imageFile.name}
              </p>
            )}
          </div>
        </div>

        {/* PREVIEW */}

        {previewUrl && (
          <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-64 object-cover"
            />
          </div>
        )}

        {/* PRICE + STOCK */}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-500">
              Price tag (INR)
            </label>

            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="2999"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm bg-white text-slate-800 placeholder-slate-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-500">
              Supply stock volume
            </label>

            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="10"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm bg-white text-slate-800 placeholder-slate-400"
            />
          </div>
        </div>

        {/* SUBMIT */}

        <button
          type="submit"
          disabled={isLoading || isUploadingImage}
          className="w-full btn-3d btn-3d-seller btn-shimmer-wrap disabled:opacity-50 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xs"
        >
          {isLoading || isUploadingImage ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}

          {isUploadingImage ? "Uploading Image..." : "Publish Product Listing"}
        </button>
      </form>
    </div>
  );
};

export default AddProduct;
