export const CARD_GRADIENTS = [
  { id: 'ocean',  preview: '#1a8fff', css: 'linear-gradient(135deg, rgba(0,120,255,0.22) 0%, rgba(56,204,248,0.16) 50%, rgba(255,255,255,0.18) 100%)' },
  { id: 'sunset', preview: '#ff7b3a', css: 'linear-gradient(135deg, rgba(255,80,50,0.18) 0%, rgba(255,160,0,0.20) 60%, rgba(255,220,80,0.12) 100%)' },
  { id: 'forest', preview: '#2ecc71', css: 'linear-gradient(135deg, rgba(0,180,80,0.18) 0%, rgba(0,200,160,0.16) 60%, rgba(0,240,200,0.10) 100%)' },
  { id: 'cosmic', preview: '#9b59b6', css: 'linear-gradient(135deg, rgba(120,0,255,0.20) 0%, rgba(200,0,200,0.14) 55%, rgba(80,0,255,0.10) 100%)' },
  { id: 'rose',   preview: '#e91e8c', css: 'linear-gradient(135deg, rgba(255,50,100,0.18) 0%, rgba(200,50,180,0.14) 55%, rgba(255,100,200,0.10) 100%)' },
  { id: 'steel',  preview: '#90a4ae', css: 'linear-gradient(135deg, rgba(100,150,200,0.16) 0%, rgba(180,200,220,0.20) 60%, rgba(240,248,255,0.18) 100%)' },
] as const;

export type CardGradient = (typeof CARD_GRADIENTS)[number];
