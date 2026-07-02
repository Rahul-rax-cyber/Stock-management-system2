/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MasterItem } from '../types';
import { X, Plus, Trash2, Edit2, Check, Search } from 'lucide-react';

interface ManageItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: MasterItem[];
  onSave: (updatedItems: MasterItem[]) => void;
}

export const ManageItemsModal: React.FC<ManageItemsModalProps> = ({
  isOpen,
  onClose,
  items,
  onSave,
}) => {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  
  // New item form state
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newDefaultStock, setNewDefaultStock] = useState('');

  // Editing item state
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDefaultStock, setEditDefaultStock] = useState('');

  // Delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Search filter state
  const [searchTerm, setSearchTerm] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newItem: MasterItem = {
      id: `item_${Date.now()}`,
      name: newName.trim(),
      defaultPrice: parseFloat(newPrice) || 0,
      defaultOpenStock: parseInt(newDefaultStock) || 0,
    };

    onSave([...items, newItem]);
    
    // Reset form
    setNewName('');
    setNewPrice('');
    setNewDefaultStock('');
  };

  const startEditing = (item: MasterItem) => {
    setEditingItemId(item.id);
    setEditName(item.name);
    setEditPrice(item.defaultPrice.toString());
    setEditDefaultStock(item.defaultOpenStock.toString());
  };

  const saveEdit = (id: string) => {
    if (!editName.trim()) return;

    const updated = items.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          name: editName.trim(),
          defaultPrice: parseFloat(editPrice) || 0,
          defaultOpenStock: parseInt(editDefaultStock) || 0,
        };
      }
      return item;
    });

    onSave(updated);
    setEditingItemId(null);
  };

  const handleDeleteItem = (id: string) => {
    onSave(items.filter((item) => item.id !== id));
    setConfirmDeleteId(null);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manage-items-title"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 id="manage-items-title" className="text-lg font-display font-bold text-slate-800">
              Manage Items Inventory
            </h2>
            <p className="text-xs text-slate-400">Configure catalog products, default selling prices, and base opening stock levels.</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Add Item Form */}
          <form onSubmit={handleAddItem} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Add New Catalog Item
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-5">
                <label htmlFor="new-item-name" className="block text-[11px] font-medium text-slate-500 mb-1">Item Name</label>
                <input
                  id="new-item-name"
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Item G or Soap"
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none bg-white"
                />
              </div>

              <div className="sm:col-span-3">
                <label htmlFor="new-item-price" className="block text-[11px] font-medium text-slate-500 mb-1">Default Price (₹)</label>
                <input
                  id="new-item-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none bg-white font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="new-item-stock" className="block text-[11px] font-medium text-slate-500 mb-1">Base Stock</label>
                <input
                  id="new-item-stock"
                  type="number"
                  min="0"
                  value={newDefaultStock}
                  onChange={(e) => setNewDefaultStock(e.target.value)}
                  placeholder="0"
                  className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none bg-white font-mono"
                />
              </div>

              <button
                type="submit"
                className="sm:col-span-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors h-9"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </form>

          {/* Catalog List */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Catalog Items ({items.length})
              </h3>
              <div className="relative w-full sm:w-48">
                <input
                  type="text"
                  placeholder="Search catalog..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-7 pr-3 py-1 text-xs border border-slate-200 rounded-lg focus:border-indigo-500 focus:outline-none bg-white placeholder:text-slate-400 font-medium"
                />
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="text-slate-400 text-center text-xs py-4">No items configured. Add one above to start!</p>
            ) : items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 ? (
              <p className="text-slate-400 text-center text-xs py-4">No catalog products match "{searchTerm}".</p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500">
                      <th className="py-2.5 px-3">Item Name</th>
                      <th className="py-2.5 px-3">Default Price</th>
                      <th className="py-2.5 px-3">Default Open Stock</th>
                      <th className="py-2.5 px-3 text-right w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items
                      .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map((item) => {
                      const isEditing = editingItemId === item.id;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/40">
                          {isEditing ? (
                            <>
                              {/* Edit Name */}
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="border border-slate-200 rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-indigo-500 font-medium"
                                  aria-label="Edit item name"
                                />
                              </td>
                              {/* Edit Price */}
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editPrice}
                                  onChange={(e) => setEditPrice(e.target.value)}
                                  className="border border-slate-200 rounded px-2 py-1 text-xs w-24 focus:outline-none focus:border-indigo-500 font-mono"
                                  aria-label="Edit default price"
                                />
                              </td>
                              {/* Edit Default Stock */}
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  min="0"
                                  value={editDefaultStock}
                                  onChange={(e) => setEditDefaultStock(e.target.value)}
                                  className="border border-slate-200 rounded px-2 py-1 text-xs w-24 focus:outline-none focus:border-indigo-500 font-mono"
                                  aria-label="Edit default open stock"
                                />
                              </td>
                              {/* Save Edit Button */}
                              <td className="py-2 px-3 text-right">
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => saveEdit(item.id)}
                                    className="p-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 rounded"
                                    aria-label="Save changes"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingItemId(null)}
                                    className="p-1 bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200 rounded"
                                    aria-label="Cancel editing"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              {/* View Mode */}
                              <td className="py-3 px-3 font-semibold text-slate-700">{item.name}</td>
                              <td className="py-3 px-3 font-mono text-slate-600">₹{item.defaultPrice.toFixed(2)}</td>
                              <td className="py-3 px-3 font-mono text-slate-600">{item.defaultOpenStock}</td>
                              <td className="py-3 px-3 text-right">
                                {confirmDeleteId === item.id ? (
                                  <div className="flex justify-end items-center gap-1.5">
                                    <button
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="px-2 py-1 text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors"
                                      aria-label={`Confirm deletion of ${item.name}`}
                                    >
                                      Delete
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="px-1.5 py-1 text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                                      aria-label="Cancel deletion"
                                    >
                                      No
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex justify-end gap-1">
                                    <button
                                      onClick={() => {
                                        setConfirmDeleteId(null);
                                        startEditing(item);
                                      }}
                                      className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-100"
                                      aria-label={`Edit ${item.name}`}
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteId(item.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                                      aria-label={`Delete ${item.name}`}
                                      type="button"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
