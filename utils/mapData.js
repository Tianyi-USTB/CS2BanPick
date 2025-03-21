// CS2竞技地图数据
const maps = [
  {
    id: 'de_mirage',
    name: 'Mirage',
    displayName: '荒漠迷城',
    image: 'https://img.dexbug.com/i/2025/03/22/vnnu9.png',
    logo: '/images/logos/mirage.png'
  },
  {
    id: 'de_inferno',
    name: 'Inferno',
    displayName: '炙热沙城',
    image: 'https://img.dexbug.com/i/2025/03/22/vmqes.png',
    logo: '/images/logos/inferno.png'
  },
  {
    id: 'de_anubis',
    name: 'Anubis',
    displayName: '阿努比斯',
    image: 'https://img.dexbug.com/i/2025/03/22/vr11l.png',
    logo: '/images/logos/anubis.png'
  },
  {
    id: 'de_ancient',
    name: 'Ancient',
    displayName: '远古遗迹',
    image: 'https://img.dexbug.com/i/2025/03/22/vptbk.png',
    logo: '/images/logos/ancient.png'
  },
  {
    id: 'de_dust2',
    name: 'Dust II',
    displayName: '炼狱小镇',
    image: 'https://img.dexbug.com/i/2025/03/22/vn5xj.jpg',
    logo: '/images/logos/dust2.png'
  },
  {
    id: 'de_train',
    name: 'Train',
    displayName: '列车停放站',
    image: 'https://img.dexbug.com/i/2025/03/22/voxpi.png',
    logo: '/images/logos/train.png'
  },
  {
    id: 'de_nuke',
    name: 'Nuke',
    displayName: '核子危机',
    image: 'https://img.dexbug.com/i/2025/03/22/vok6k.png',
    logo: '/images/logos/nuke.png'
  }
];

function getAllMaps() {
  return [...maps];
}

function getMapById(id) {
  return maps.find(map => map.id === id);
}

module.exports = {
  getAllMaps,
  getMapById
};
