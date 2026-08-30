import { learnerProfiles } from "@/db/schema";

export function publicLearnerProfile(profile: typeof learnerProfiles.$inferSelect) {
  return {
    id: profile.id,
    firstName: profile.firstName,
    surname: profile.surname,
    email: profile.email,
    country: profile.country,
    selectedPattern: profile.selectedPattern,
    profileStyle: profile.profileStyle,
    authProvider: profile.authProvider,
    avatarUrl: profile.avatarUrl,
    createdAt: profile.createdAt,
  };
}
