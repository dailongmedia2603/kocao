import json
import sys
from pathlib import Path
from typing import List, Dict, Optional

try:
    import yt_dlp
except ImportError:
    print("Error: yt-dlp not installed. Run: pip install yt-dlp")
    sys.exit(1)


class SimpleTikTokScraper:
    def __init__(self, download_path: str = "uploads"):
        self.download_path = Path(download_path)
        self.download_path.mkdir(parents=True, exist_ok=True)
        self.video_count = 0
    
    def extract_username(self, channel_link: str) -> str:
        channel_link = channel_link.strip()
        
        if '@' in channel_link:
            username = channel_link.split('@')[1].split('/')[0].split('?')[0]
        else:
            username = channel_link.strip('/')
        
        return username.strip()
    
    def format_number(self, num: Optional[int]) -> str:
        if num is None:
            return "0"
        
        try:
            num = int(num)
        except (ValueError, TypeError):
            return "0"
        
        if num >= 1_000_000_000:
            return f"{num / 1_000_000_000:.1f}B"
        elif num >= 1_000_000:
            return f"{num / 1_000_000:.1f}M"
        elif num >= 1_000:
            return f"{num / 1_000:.1f}K"
        return str(num)
    
    def get_channel_videos(self, channel_link: str, max_videos: Optional[int] = None) -> List[Dict]:
        username = self.extract_username(channel_link)
        
        if not channel_link.startswith('http'):
            channel_link = f"https://www.tiktok.com/@{username}"
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': True,
            'ignoreerrors': True,
        }
        
        if max_videos is not None:
            ydl_opts['playlistend'] = max_videos
        
        videos = []
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                result = ydl.extract_info(channel_link, download=False)
                
                if not result:
                    raise Exception("Failed to extract channel information")
                
                entries = result.get('entries', [result])
                
                for entry in entries:
                    if entry is None:
                        continue
                    
                    video_data = {
                        'video_id': entry.get('id', ''),
                        'title': entry.get('title', ''),
                        'description': entry.get('description', ''),
                        'duration': entry.get('duration', 0),
                        'view_count': entry.get('view_count', 0),
                        'like_count': entry.get('like_count', 0),
                        'comment_count': entry.get('comment_count', 0),
                        'repost_count': entry.get('repost_count', 0),
                        'uploader': entry.get('uploader', username),
                        'upload_date': entry.get('upload_date', ''),
                        'webpage_url': entry.get('webpage_url', entry.get('url', '')),
                    }
                    
                    videos.append(video_data)
                
        except Exception as e:
            raise Exception(f"Error extracting videos: {str(e)}")
        
        return videos
    
    def list_videos_with_metadata(self, channel_link: str, max_videos: Optional[int] = None) -> Dict:
        videos = self.get_channel_videos(channel_link, max_videos)
        
        if not videos:
            return {'success': False, 'error': 'No videos found', 'videos': []}
        
        username = self.extract_username(channel_link)
        
        output_file = self.download_path / f"{username}_videos_metadata.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(videos, f, indent=2, ensure_ascii=False)
        
        return {
            'success': True,
            'videos': videos,
            'metadata_file': str(output_file),
            'total_videos': len(videos)
        }
    
    def download_all_videos(self, channel_link: str, max_videos: Optional[int] = None) -> Dict:
        username = self.extract_username(channel_link)
        
        if not channel_link.startswith('http'):
            channel_link = f"https://www.tiktok.com/@{username}"
        
        self.video_count = 0
        
        ydl_opts = {
            'outtmpl': str(self.download_path / f'{username}_%(autonumber)03d_%(id)s.%(ext)s'),
            'format': 'best',
            'quiet': False,
            'no_warnings': False,
            'progress_hooks': [self._download_progress_hook],
            'ignoreerrors': True,
        }
        
        if max_videos is not None:
            ydl_opts['playlistend'] = max_videos
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([channel_link])
                
            return {
                'success': True,
                'downloaded': self.video_count,
                'download_path': str(self.download_path.absolute())
            }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'downloaded': self.video_count
            }
    
    def _download_progress_hook(self, d: Dict):
        if d['status'] == 'finished':
            self.video_count += 1


def main():
    print("TikTok Channel Scraper")
    print("=" * 50)
    
    channel_link = input("\nEnter TikTok channel link: ").strip()
    
    if not channel_link:
        print("Error: No channel link provided")
        return
    
    print("\nOptions:")
    print("1. List videos with metadata (no download)")
    print("2. Download all videos")
    
    option = input("\nSelect option (1 or 2): ").strip()
    
    if option not in ['1', '2']:
        print("Error: Invalid option")
        return
    
    scraper = SimpleTikTokScraper()
    
    try:
        print("\nProcessing all videos...")
        
        if option == '1':
            result = scraper.list_videos_with_metadata(channel_link)
            if result['success']:
                print(f"Saved: {result['metadata_file']}")
                print(f"Total: {result['total_videos']} videos")
            else:
                print(f"Error: {result.get('error', 'Unknown error')}")
        else:
            result = scraper.download_all_videos(channel_link)
            if result['success']:
                print(f"Downloaded: {result['downloaded']} videos")
                print(f"Location: {result['download_path']}")
            else:
                print(f"Error: {result.get('error', 'Unknown error')}")
                print(f"Downloaded: {result['downloaded']} videos")
    
    except Exception as e:
        print(f"Error: {str(e)}")
    
    print("Done")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nProcess interrupted by user")
    except Exception as e:
        print(f"\nFatal error: {str(e)}")