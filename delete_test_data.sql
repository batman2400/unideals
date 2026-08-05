-- Run this script in the Supabase SQL Editor to delete the test data

-- 1. Delete all deals that came from the mock data
DELETE FROM deals
WHERE title IN (
  'TechNova Pro',
  'Brew & Co.',
  'Essence Wear',
  'Nexus Fitness',
  'Habitat Home',
  'Creative Cloud',
  'ByteBooks',
  'Grind House',
  'FitFuel',
  'ThreadLine',
  'Nest & Rest',
  'PixelForge',
  'tech',
  '12345',
  'Gsisbsb',
  'Tech1'
);

-- 2. Delete all brands that match the mock data names
DELETE FROM brands
WHERE name IN (
  'TechNova',
  'Brew & Co.',
  'Essence Wear',
  'Nexus Fitness',
  'Habitat Home',
  'Creative Cloud',
  'ByteBooks',
  'Grind House',
  'FitFuel',
  'ThreadLine',
  'Nest & Rest',
  'PixelForge',
  'tech',
  '12345',
  'techson'
);

-- 3. Delete any test events with similar fake names
DELETE FROM events
WHERE title ILIKE '%test%' 
   OR title ILIKE '%demo%' 
   OR title ILIKE '%fake%';
