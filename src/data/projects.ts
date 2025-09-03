export interface Project {
  id: string;
  name: string;
  type: string;
  logo: {
    text: string;
    bgColor: string;
  };
  priority: 'High' | 'Medium' | 'Low';
  status: 'Active' | 'Completed' | 'Inactive';
  isFavorite: boolean;
  description: string;
  projectId: string;
  value: string;
  dueDate: string;
  team: string[];
  clientLogo: string;
  totalHours: number;
  comments: number;
  attachments: number;
}

export const projectsData: Project[] = [
  {
    id: '1',
    name: 'Truelysell',
    type: 'Web App',
    logo: { text: 'T', bgColor: 'bg-purple-200' },
    priority: 'High',
    status: 'Active',
    isFavorite: true,
    description: 'Kofejob is a freelancers marketplace where you can post projects & get instant help.',
    projectId: '#12145',
    value: '$03,50,000',
    dueDate: '15 Oct 2023',
    team: ['https://i.pravatar.cc/150?img=1', 'https://i.pravatar.cc/150?img=2', 'https://i.pravatar.cc/150?img=3'],
    clientLogo: 'https://i.pravatar.cc/150?img=10',
    totalHours: 100,
    comments: 2,
    attachments: 4,
  },
  {
    id: '2',
    name: 'Dreamschat',
    type: 'Web App',
    logo: { text: 'D', bgColor: 'bg-orange-200' },
    priority: 'High',
    status: 'Active',
    isFavorite: true,
    description: 'Kofejob is a freelancers marketplace where you can post projects & get instant help.',
    projectId: '#12146',
    value: '$02,15,000',
    dueDate: '19 Oct 2023',
    team: ['https://i.pravatar.cc/150?img=4', 'https://i.pravatar.cc/150?img=5', 'https://i.pravatar.cc/150?img=6'],
    clientLogo: 'https://i.pravatar.cc/150?img=11',
    totalHours: 80,
    comments: 2,
    attachments: 4,
  },
  {
    id: '3',
    name: 'Truelysell',
    type: 'Web App',
    logo: { text: 'T', bgColor: 'bg-gray-700' },
    priority: 'High',
    status: 'Active',
    isFavorite: true,
    description: 'Kofejob is a freelancers marketplace where you can post projects & get instant help.',
    projectId: '#12147',
    value: '$01,45,000',
    dueDate: '12 Oct 2023',
    team: ['https://i.pravatar.cc/150?img=7', 'https://i.pravatar.cc/150?img=8', 'https://i.pravatar.cc/150?img=9'],
    clientLogo: 'https://i.pravatar.cc/150?img=12',
    totalHours: 75,
    comments: 2,
    attachments: 4,
  },
  {
    id: '4',
    name: 'Servbook',
    type: 'Web App',
    logo: { text: 'S', bgColor: 'bg-pink-200' },
    priority: 'High',
    status: 'Active',
    isFavorite: false,
    description: 'Kofejob is a freelancers marketplace where you can post projects & get instant help.',
    projectId: '#12148',
    value: '$02,15,000',
    dueDate: '24 Oct 2023',
    team: ['https://i.pravatar.cc/150?img=13', 'https://i.pravatar.cc/150?img=14', 'https://i.pravatar.cc/150?img=15'],
    clientLogo: 'https://i.pravatar.cc/150?img=16',
    totalHours: 75,
    comments: 2,
    attachments: 4,
  },
];