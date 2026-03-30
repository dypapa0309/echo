import { RecordingContext } from '../types/index';

type GeoLocation = NonNullable<RecordingContext['location']> & {
  address?: string;
  placeType?: 'office' | 'meeting_room' | 'car' | 'outdoor' | 'home' | 'other';
};

type CalendarEventRef = NonNullable<RecordingContext['calendarEvent']> & {
  attendees?: string[];
};

type DeviceState = {
  audioQuality: 'low' | 'medium' | 'high';
  connectivity: 'offline' | 'wifi' | 'mobile';
};

type ExpoLocationModule = typeof import('expo-location');
type ExpoCalendarModule = typeof import('expo-calendar');

type CalendarAttendeeLike = {
  email?: string;
  name?: string;
};

type CalendarEventLike = {
  id: string;
  title?: string;
  startDate: string | Date;
  endDate: string | Date;
  attendees?: CalendarAttendeeLike[];
  allDay?: boolean;
};

/**
 * Context Mapping Engine
 * 
 * 녹음 시점의 메타데이터 자동 수집
 * - GPS 위치
 * - 현재 시간
 * - 캘린더 이벤트
 */

export class ContextMappingEngine {
  private locationCache: GeoLocation | null = null;

  private locationModule: ExpoLocationModule | null | undefined;

  private calendarCache: CalendarEventRef | null = null;

  private calendarModule: ExpoCalendarModule | null | undefined;

  /**
   * Build complete recording context
   */
  async buildContext(): Promise<RecordingContext> {
    const [location, calendarEvent] = await Promise.all([
      this.getLocation(),
      this.getActiveCalendarEvent(),
    ]);
    await this.getDeviceState();

    return {
      location: location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            placeName: location.placeName,
          }
        : undefined,
      calendarEvent,
    };
  }

  /**
   * Get current GPS location
   */
  async getLocation(): Promise<GeoLocation | undefined> {
    try {
      const locationModule = this.getLocationModule();
      if (!locationModule) {
        return this.locationCache ?? undefined;
      }

      const permission = await locationModule.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        return this.locationCache ?? undefined;
      }

      const position = await locationModule.getCurrentPositionAsync({
        accuracy: locationModule.Accuracy.Balanced,
      });

      const placeName = await ContextMappingEngine.getPlaceName(
        position.coords.latitude,
        position.coords.longitude
      );

      const nextLocation: GeoLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        placeName,
      };

      this.locationCache = nextLocation;
      return nextLocation;
    } catch (error) {
      console.error('Location error:', error);
      return this.locationCache ?? undefined;
    }
  }

  /**
   * Classify location type based on address
   */
  private classifyPlaceType(
    address: any
  ): 'office' | 'meeting_room' | 'car' | 'outdoor' | 'home' | 'other' {
    const name = (address.name || '').toLowerCase();

    if (name.includes('회의') || name.includes('conference') || name.includes('room')) {
      return 'meeting_room';
    }
    if (name.includes('office') || name.includes('company') || name.includes('빌딩')) {
      return 'office';
    }
    if (name.includes('home') || name.includes('집')) {
      return 'home';
    }
    if (name.includes('카페') || name.includes('cafe')) {
      return 'outdoor';
    }

    return 'other';
  }

  /**
   * Get active calendar event (meeting)
   */
  async getActiveCalendarEvent(): Promise<CalendarEventRef | undefined> {
    try {
      void this.classifyPlaceType;
      const calendarModule = this.getCalendarModule();
      if (!calendarModule) {
        return this.calendarCache ?? undefined;
      }

      const permission = await calendarModule.requestCalendarPermissionsAsync();
      if (!permission.granted) {
        return this.calendarCache ?? undefined;
      }

      const calendars = await calendarModule.getCalendarsAsync(
        calendarModule.EntityTypes.EVENT
      );
      const visibleCalendarIds = calendars
        .filter(calendar => !calendar.isPrimary || calendar.allowsModifications !== false || Boolean(calendar.title))
        .map(calendar => calendar.id);

      if (visibleCalendarIds.length === 0) {
        return this.calendarCache ?? undefined;
      }

      const now = Date.now();
      const windowStart = new Date(now - 30 * 60 * 1000);
      const windowEnd = new Date(now + 2 * 60 * 60 * 1000);
      const events = await calendarModule.getEventsAsync(
        visibleCalendarIds,
        windowStart,
        windowEnd
      );

      const selectedEvent = pickBestCalendarEvent(events, now);
      if (!selectedEvent) {
        return this.calendarCache ?? undefined;
      }

      const selectedAttendees = (selectedEvent as CalendarEventLike).attendees;
      const nextEvent: CalendarEventRef = {
        id: selectedEvent.id,
        title: selectedEvent.title?.trim() || '진행 중 일정',
        startDate: new Date(selectedEvent.startDate).getTime(),
        endDate: new Date(selectedEvent.endDate).getTime(),
        attendees: selectedAttendees
          ?.map((attendee: CalendarAttendeeLike) => attendee.email || attendee.name || '')
          .filter(Boolean),
      };

      this.calendarCache = nextEvent;
      return nextEvent;
    } catch (error) {
      console.error('Calendar fetch error:', error);
      return this.calendarCache ?? undefined;
    }
  }

  /**
   * Get current device state
   */
  private async getDeviceState(): Promise<DeviceState> {
    // Get audio quality (based on ambient noise)
    const audioQuality = await this.estimateAudioQuality();

    // Get connectivity
    const connectivity = await this.getConnectivity();

    return {
      audioQuality,
      connectivity,
    };
  }

  /**
   * Estimate audio quality based on ambient noise
   */
  private async estimateAudioQuality(): Promise<'low' | 'medium' | 'high'> {
    // In real implementation, analyze audio input during recording
    // For MVP, return high by default
    return 'high';
  }

  /**
   * Get current connectivity status
   */
  private async getConnectivity(): Promise<'offline' | 'wifi' | 'mobile'> {
    try {
      // Integration with react-native-netinfo
      // For MVP, assume online
      return 'wifi';
    } catch {
      return 'offline';
    }
  }

  /**
   * Get place name from coordinates
   */
  static async getPlaceName(latitude: number, longitude: number): Promise<string> {
    try {
      const locationModule = loadLocationModule();
      if (!locationModule) {
        return 'Unknown Location';
      }

      const places = await locationModule.reverseGeocodeAsync({ latitude, longitude });
      const place = places[0];
      if (!place) {
        return 'Unknown Location';
      }

      return [
        place.name,
        place.street,
        place.district,
        place.city,
      ]
        .filter(Boolean)
        .slice(0, 2)
        .join(' · ') || 'Unknown Location';
    } catch (error) {
      console.error('Reverse geolocation error:', error);
      return 'Unknown Location';
    }
  }

  private getLocationModule(): ExpoLocationModule | null {
    if (this.locationModule !== undefined) {
      return this.locationModule;
    }

    this.locationModule = loadLocationModule();
    return this.locationModule;
  }

  private getCalendarModule(): ExpoCalendarModule | null {
    if (this.calendarModule !== undefined) {
      return this.calendarModule;
    }

    this.calendarModule = loadCalendarModule();
    return this.calendarModule;
  }

  /**
   * Calculate distance between two points (in km)
   */
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

function loadLocationModule(): ExpoLocationModule | null {
  try {
    return require('expo-location') as ExpoLocationModule;
  } catch (error) {
    console.warn('[ContextMapping] expo-location is unavailable:', error);
    return null;
  }
}

function loadCalendarModule(): ExpoCalendarModule | null {
  try {
    return require('expo-calendar') as ExpoCalendarModule;
  } catch (error) {
    console.warn('[ContextMapping] expo-calendar is unavailable:', error);
    return null;
  }
}

export function pickBestCalendarEvent<T extends CalendarEventLike>(
  events: T[],
  now = Date.now()
): T | undefined {
  if (events.length === 0) {
    return undefined;
  }

  const normalizedEvents = events
    .map(event => ({
      event,
      startMs: new Date(event.startDate).getTime(),
      endMs: new Date(event.endDate).getTime(),
      titleQuality: getEventTitleScore(event.title),
    }))
    .filter(
      item =>
        Number.isFinite(item.startMs) &&
        Number.isFinite(item.endMs) &&
        item.endMs > item.startMs &&
        !item.event.allDay
    )
    .sort((a, b) => a.startMs - b.startMs);

  const activeEvents = normalizedEvents
    .filter(item => item.startMs <= now && item.endMs >= now)
    .sort((a, b) => {
      const aProgressDistance = Math.abs(now - a.startMs);
      const bProgressDistance = Math.abs(now - b.startMs);

      if (a.titleQuality !== b.titleQuality) {
        return b.titleQuality - a.titleQuality;
      }
      return aProgressDistance - bProgressDistance;
    });

  if (activeEvents[0]) {
    return activeEvents[0].event;
  }

  const upcomingEvents = normalizedEvents
    .filter(item => item.startMs >= now)
    .sort((a, b) => {
      const aMinutesUntilStart = (a.startMs - now) / (60 * 1000);
      const bMinutesUntilStart = (b.startMs - now) / (60 * 1000);

      if (aMinutesUntilStart !== bMinutesUntilStart) {
        return aMinutesUntilStart - bMinutesUntilStart;
      }
      return b.titleQuality - a.titleQuality;
    });

  const upcomingEvent = upcomingEvents[0];
  if (!upcomingEvent) {
    return undefined;
  }

  const minutesUntilStart = (upcomingEvent.startMs - now) / (60 * 1000);
  if (minutesUntilStart <= 45) {
    return upcomingEvent.event;
  }

  return undefined;
}

function getEventTitleScore(title?: string): number {
  const trimmed = title?.trim();
  if (!trimmed) {
    return 0;
  }

  let score = 1;
  const lower = trimmed.toLowerCase();

  if (trimmed.length >= 6) {
    score += 1;
  }
  if (/[가-힣a-z]/i.test(trimmed) && /\d/.test(trimmed)) {
    score += 0.5;
  }
  if (/(회의|미팅|sync|standup|review|1:1|체크인|상담|상담|배포|기획)/i.test(trimmed)) {
    score += 1;
  }
  if (/(캘린더|일정|스케줄|약속|busy|hold|reminder|알림|event)/i.test(lower)) {
    score -= 0.75;
  }

  return score;
}

export const contextMappingEngine = new ContextMappingEngine();
