import { User, Chat } from './types';

// Seed data for fresh installs

export const MOCK_USERS: User[] = [
  {
    id: '1',
    name: 'Jessica Miller',
    email: 'jessica@vchat.com',
    password: 'password',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAiKXawfvNgQh4vBj_7cFUmKhABLB0ubEFMWLKcdierjaI5ToulOvw8ijj_VSVu8ytlX5O7kM-sYCkQJHLPWXEa1C9VxSuVKT_XwL2SMDbvGVkVqC0z34Uucx1yIOXWb5Qya_f-C4IYA5dm5kkAHaajJawg0U147CLXrF2umJh_KUBMhbcv-JVi580XaVnr890vbR0Zfc-cKhYoCm2kzTeMpaeKw6TXEux1nNUqAeuwoTIhdgGsU5kmGdoSheuZcxMiv8EYsZ1RUPQR',
    isOnline: true,
    status: 'Can\'t wait for the event!'
  },
  {
    id: '2',
    name: 'David Chen',
    email: 'david@vchat.com',
    password: 'password',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC3HmFvHjMn4U7SM5EgrwBc7d3PdPWtNG3mRpl6HGsmzPjW7ZstjLIsYrE7TX3GpqRgi4yax8um2N1keoFips0T2kpZXkWUeMzYPgIv_cB2AK2uzSq-ro9opamFMT0PJBcCqe8eCE9tuo2AY9RYumy9HseHCsUu1QsnJoTU9wt7S5AXiWW8TigU7P-WrZn0SUvb7bkt3-syW8FGHi_6j9kKGKj0OVkuysb0yi5cFQxgxn53AOK7jeKCe61e-2ICYgOErskBF8iUEI7_',
    isOnline: false,
    status: 'At work'
  },
  {
    id: '3',
    name: 'Maria Garcia',
    email: 'maria@vchat.com',
    password: 'password',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAO94hkJSfG2a9XZR6QjflHhku9Z08D3ds8n1Vf3Tst3twTESIXAZFnaH94ipX8nORv3eDbhIN1SqG-N2rMb_50reLSPT8GpkZ7JmbBUcTE6qM9CLd2u1W9Wm6AFiNZZ3XfVpBUgX90-u6SU2NjjBl37unvcZD-R76FXNADzdGd8rxZlUpj72Po8xioRkVk7-TAzz2DWkBWsGx49gt4oIlJCLvq9W6wJr-UqlcxLVPujU5SPb3KPeUBpBI7W7IClCcr0ChUL05dqFDZ',
    isOnline: true,
    status: 'Busy'
  },
  {
    id: '4',
    name: 'Tom Wilson',
    email: 'tom@vchat.com',
    password: 'password',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA91QNGloxl8KoqcD--dts5HAKFZAdmNgdsMwH7ObOhg97cMUxztGa5IhKiwuIJejpjqUsGc4C_dV8Su2PIADCq_x-UsSA0A8frkS-oPbDDsDM8AZwF0Uo226Nan-TvkFlKnAa7VBLeOoGZRhDNZ2mbJ6v9lLqrJZlA-fH_34b7EKKMkFFeI6JGalQR_HlXFpBqLBe0QMDe2K4dLUzMlCdRGfCwCjwGMDVojy3c-04YKn5-n9zcz5xabEZ8k4Jeq7brS9uy69glEUCi',
    isOnline: false,
    status: 'Traveling'
  },
  {
    id: '5',
    name: 'Alex Rivera',
    email: 'alex@vchat.com',
    password: 'password',
    avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBo_pSkY5fDHIchEuqUc7bidLK3qKr89z3t2NyXVhJ-4k-HR339Gs_BVEs7dHL7cUkTp0wHGYLEfcHTJ8PSlK74OR9tf-dgU-11zOgYfU00WpnoJWQ3Wn_krXYGi3QWLy37g9xjbxT4QixGMjShr8mVGJf7JlUrRqvUnCv1_1FrSnvu6FHlD21ykB5RUrelZfmsmkls9mwmYGnHaonQPM9OUi0q4kbC9SbUr21aIVpWdFoXG6dkz4DmQM5BHTESg8s5HwSbCeKhqe63',
    isOnline: true,
    status: 'Online'
  }
];

export const CURRENT_USER: User = {
    id: 'me',
    name: 'Guest',
    email: 'guest@vchat.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest',
    isOnline: true
};

export const MOCK_CHATS: Chat[] = [
  {
    id: 'global-group',
    name: 'General Chat',
    isGroup: true,
    participants: ['1', '2', '3', '4', '5'],
    lastMessage: 'Welcome to vChat!',
    lastMessageTime: new Date().toISOString(),
    unreadCount: 0,
    messages: [
      { id: 'm1', text: 'Welcome to vChat!', senderId: '1', timestamp: new Date().toISOString() }
    ],
    avatar: 'https://ui-avatars.com/api/?name=General+Chat&background=F97316&color=fff'
  }
];