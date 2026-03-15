-- Phase J: Client Portal — Migration 006: Enable Realtime
-- Adds client_notifications to the Supabase Realtime publication
-- so NotificationBell can subscribe to INSERT events via postgres_changes.

ALTER PUBLICATION supabase_realtime ADD TABLE client_notifications;
