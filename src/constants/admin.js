export const HARDCODED_ADMIN = {
  _id: "hardcoded-admin",
  name: "Owner",
  email: "mib@kobita.com",
  phone: "01319000077",
  role: "owner",
  password: "kobita",
  isHardcoded: true,
  slug: "X666X",
  onboardingComplete: true,
  gender: "পুরুষ",
  avatar: {
    url: "https://res.cloudinary.com/ddsfmccyi/image/upload/v1773928047/avatars/uyi6c9kmtwlw8ayd6qpe.webp",
    publicId: "owner",
  },
};

export const STAFF_ROLES = ["teacher", "principal", "admin"];

export const ROLE_PERMISSIONS = {
  owner: ["admin", "principal", "teacher"],
  admin: ["admin", "principal", "teacher"],
  principal: ["principal", "teacher"],
  teacher: [],
};

export const ROLE_PREFIX = {
  student: "S",
  teacher: "T",
  principal: "P",
  admin: "A",
  owner: "O",
};
