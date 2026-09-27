import {Composition} from 'remotion';
import {MotionVideo} from './MotionVideo';

export const Root: React.FC = () => (
  <Composition
    id="MotionVideo"
    component={MotionVideo}
    durationInFrames={240}
    fps={24}
    width={1080}
    height={1920}
  />
);
