import { supabase } from './supabase';

type NotificationType = 'follow' | 'profile_view' | 'message';

type CreateNotificationParams = {
  userId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  body?: string | null;
  relatedUserId?: string | null;
  relatedMessageId?: number | null;
};

export async function createNotification({
  userId,
  actorId = null,
  type,
  title,
  body = null,
  relatedUserId = null,
  relatedMessageId = null,
}: CreateNotificationParams) {
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      actor_id: actorId,
      type,
      title,
      body,
      related_user_id: relatedUserId,
      related_message_id: relatedMessageId,
    });

    if (error) {
      console.log('Error creando notificación:', error.message);
    }
  } catch (error) {
    console.log('Error inesperado creando notificación:', error);
  }
}

export async function createProfileViewNotificationOnce({
  userId,
  actorId,
  relatedUserId,
}: {
  userId: string;
  actorId: string;
  relatedUserId: string;
}) {
  try {
    if (!userId || !actorId || userId === actorId) return;

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: existing, error: existingError } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('actor_id', actorId)
      .eq('type', 'profile_view')
      .gte('created_at', tenMinutesAgo)
      .maybeSingle();

    if (existingError) {
      console.log(
        'Error revisando notificación de visita:',
        existingError.message
      );
      return;
    }

    if (existing) return;

    await createNotification({
      userId,
      actorId,
      type: 'profile_view',
      title: 'Visitaron tu perfil',
      body: 'Alguien entró a ver tu perfil.',
      relatedUserId,
    });
  } catch (error) {
    console.log(
      'Error inesperado creando notificación de visita:',
      error
    );
  }
}

export async function createFollowNotificationOnce({
  userId,
  actorId,
  relatedUserId,
}: {
  userId: string;
  actorId: string;
  relatedUserId: string;
}) {
  try {
    if (!userId || !actorId || userId === actorId) return;

    const { data: existing, error: existingError } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('actor_id', actorId)
      .eq('type', 'follow')
      .maybeSingle();

    if (existingError) {
      console.log(
        'Error revisando notificación de follow:',
        existingError.message
      );
      return;
    }

    if (existing) return;

    await createNotification({
      userId,
      actorId,
      type: 'follow',
      title: 'Nuevo seguidor',
      body: 'Alguien comenzó a seguirte.',
      relatedUserId,
    });
  } catch (error) {
    console.log(
      'Error inesperado creando notificación de follow:',
      error
    );
  }
}

export async function createMessageNotification({
  userId,
  actorId,
  relatedUserId,
  relatedMessageId,
}: {
  userId: string;
  actorId: string;
  relatedUserId: string;
  relatedMessageId?: number | null;
}) {
  try {
    if (!userId || !actorId || userId === actorId) return;

    await createNotification({
      userId,
      actorId,
      type: 'message',
      title: 'Nuevo mensaje',
      body: 'Alguien te envió un mensaje.',
      relatedUserId,
      relatedMessageId: relatedMessageId ?? null,
    });
  } catch (error) {
    console.log(
      'Error inesperado creando notificación de mensaje:',
      error
    );
  }
}